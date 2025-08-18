-- 插入示例数据

-- 插入轮播图数据
INSERT INTO banners (title, image_url, link_url, sort_order, is_active) VALUES
('欢迎使用码上购', 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=hospital%20delivery%20service%20banner%20with%20medical%20theme%20blue%20color&image_size=landscape_16_9', '/', 1, true),
('便捷扫码点餐', 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=QR%20code%20ordering%20system%20medical%20hospital%20blue%20theme&image_size=landscape_16_9', '/', 2, true),
('实时订单跟踪', 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=order%20tracking%20delivery%20hospital%20medical%20blue%20theme&image_size=landscape_16_9', '/', 3, true);

-- 注意：用户数据需要通过认证系统创建，这里只是预留结构
-- 商家数据也需要在用户注册后创建

-- 商品分类示例（将在商家注册后添加）
-- 这里先不插入具体商家和商品数据，等认证系统完成后再添加