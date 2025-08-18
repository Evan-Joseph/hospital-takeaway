-- 创建Storage bucket和权限策略

-- 创建images bucket（如果不存在）
INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- 为images bucket创建RLS策略

-- 允许所有用户查看图片
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'images');

-- 允许认证用户上传图片
CREATE POLICY "Authenticated users can upload images" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'images' AND auth.role() = 'authenticated'
);

-- 允许认证用户更新自己上传的图片
CREATE POLICY "Users can update own images" ON storage.objects FOR UPDATE USING (
  bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]
) WITH CHECK (
  bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 允许认证用户删除自己上传的图片
CREATE POLICY "Users can delete own images" ON storage.objects FOR DELETE USING (
  bucket_id = 'images' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 为商家用户创建特殊权限，允许上传到products和payment-qr文件夹
CREATE POLICY "Merchants can upload to products folder" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'images' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN ('products', 'payment-qr', 'banners')
);

CREATE POLICY "Merchants can update products folder" ON storage.objects FOR UPDATE USING (
  bucket_id = 'images' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN ('products', 'payment-qr', 'banners')
) WITH CHECK (
  bucket_id = 'images' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN ('products', 'payment-qr', 'banners')
);

CREATE POLICY "Merchants can delete from products folder" ON storage.objects FOR DELETE USING (
  bucket_id = 'images' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN ('products', 'payment-qr', 'banners')
);