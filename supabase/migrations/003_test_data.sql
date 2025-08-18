-- 添加测试商家和商品数据

-- 首先创建一个测试用户（商家）
INSERT INTO auth.users (id, email, phone, created_at, updated_at, email_confirmed_at, phone_confirmed_at)
VALUES 
('550e8400-e29b-41d4-a716-446655440001', 'test@example.com', '+8613800138001', NOW(), NOW(), NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440002', 'test2@example.com', '+8613800138002', NOW(), NOW(), NOW(), NOW()),
('550e8400-e29b-41d4-a716-446655440003', 'test3@example.com', '+8613800138003', NOW(), NOW(), NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- 创建用户配置
INSERT INTO user_profiles (id, phone, name, user_type)
VALUES 
('550e8400-e29b-41d4-a716-446655440001', '13800138001', '康复餐厅', 'merchant'),
('550e8400-e29b-41d4-a716-446655440002', '13800138002', '便民超市', 'merchant'),
('550e8400-e29b-41d4-a716-446655440003', '13800138003', '药房便利店', 'merchant')
ON CONFLICT (id) DO NOTHING;

-- 插入测试商家
INSERT INTO merchants (id, owner_id, name, description, category, address, phone, is_active)
VALUES 
('550e8400-e29b-41d4-a716-446655441001', '550e8400-e29b-41d4-a716-446655440001', '康复餐厅', '专为住院病人提供营养健康餐食，口味清淡，营养均衡', '餐饮', '医院1号楼1层', '13800138001', true),
('550e8400-e29b-41d4-a716-446655441002', '550e8400-e29b-41d4-a716-446655440002', '便民超市', '提供日用品、零食、水果等生活必需品', '超市', '医院2号楼地下1层', '13800138002', true),
('550e8400-e29b-41d4-a716-446655441003', '550e8400-e29b-41d4-a716-446655440003', '药房便利店', '非处方药品、保健品、医疗用品', '药房', '医院门诊楼1层', '13800138003', true)
ON CONFLICT (id) DO NOTHING;

-- 插入测试商品
INSERT INTO products (merchant_id, name, description, price, category, stock_quantity, is_available, image_url)
VALUES 
-- 康复餐厅商品
('550e8400-e29b-41d4-a716-446655441001', '营养粥套餐', '小米粥配咸菜，清淡易消化', 15.00, '主食', 50, true, 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=healthy%20porridge%20meal%20hospital%20food&image_size=square'),
('550e8400-e29b-41d4-a716-446655441001', '蒸蛋羹', '嫩滑蒸蛋，营养丰富', 8.00, '主食', 30, true, 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=steamed%20egg%20custard%20hospital%20meal&image_size=square'),
('550e8400-e29b-41d4-a716-446655441001', '清汤面条', '清汤挂面配青菜', 12.00, '主食', 40, true, 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=clear%20soup%20noodles%20hospital%20food&image_size=square'),
('550e8400-e29b-41d4-a716-446655441001', '银耳莲子汤', '滋补养颜，润燥清热', 10.00, '汤品', 25, true, 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=white%20fungus%20lotus%20seed%20soup&image_size=square'),
('550e8400-e29b-41d4-a716-446655441001', '小馄饨', '鲜肉馄饨，汤清味美', 18.00, '主食', 35, true, 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=small%20wontons%20hospital%20meal&image_size=square'),

-- 便民超市商品
('550e8400-e29b-41d4-a716-446655441002', '纯净水', '550ml装纯净水', 2.00, '饮品', 100, true, 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=bottled%20water%20550ml&image_size=square'),
('550e8400-e29b-41d4-a716-446655441002', '苹果', '新鲜红富士苹果，单个装', 5.00, '水果', 80, true, 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=fresh%20red%20apple%20single&image_size=square'),
('550e8400-e29b-41d4-a716-446655441002', '香蕉', '进口香蕉，营养丰富', 3.50, '水果', 60, true, 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=fresh%20banana%20imported&image_size=square'),
('550e8400-e29b-41d4-a716-446655441002', '纸巾', '抽纸3包装，柔软亲肤', 12.00, '日用品', 45, true, 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=tissue%20paper%203%20pack&image_size=square'),
('550e8400-e29b-41d4-a716-446655441002', '牛奶', '250ml纯牛奶', 4.50, '饮品', 70, true, 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=milk%20250ml%20carton&image_size=square'),
('550e8400-e29b-41d4-a716-446655441002', '饼干', '消化饼干，适合病人食用', 8.00, '零食', 55, true, 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=digestive%20biscuits%20hospital&image_size=square'),

-- 药房便利店商品
('550e8400-e29b-41d4-a716-446655441003', '体温计', '电子体温计，快速测温', 25.00, '医疗用品', 20, true, 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=digital%20thermometer%20medical&image_size=square'),
('550e8400-e29b-41d4-a716-446655441003', '口罩', '一次性医用口罩，50只装', 15.00, '医疗用品', 100, true, 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=disposable%20medical%20masks%2050%20pack&image_size=square'),
('550e8400-e29b-41d4-a716-446655441003', '维生素C', '维生素C片，增强免疫力', 28.00, '保健品', 40, true, 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=vitamin%20C%20tablets%20bottle&image_size=square'),
('550e8400-e29b-41d4-a716-446655441003', '创可贴', '防水创可贴，多种规格', 6.00, '医疗用品', 80, true, 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=waterproof%20band%20aids%20pack&image_size=square'),
('550e8400-e29b-41d4-a716-446655441003', '酒精棉片', '75%酒精棉片，消毒杀菌', 8.50, '医疗用品', 60, true, 'https://trae-api-sg.mchost.guru/api/ide/v1/text_to_image?prompt=alcohol%20cotton%20pads%2075%20percent&image_size=square')
ON CONFLICT DO NOTHING;