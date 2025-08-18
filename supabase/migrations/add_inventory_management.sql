-- 添加库存管理功能：防止超库存下单并自动扣减库存

-- 1. 创建函数：检查和扣减库存
CREATE OR REPLACE FUNCTION check_and_deduct_inventory()
RETURNS TRIGGER AS $$
DECLARE
    current_stock INTEGER;
    product_name VARCHAR(200);
BEGIN
    -- 获取当前库存和商品名称
    SELECT stock_quantity, name INTO current_stock, product_name
    FROM products 
    WHERE id = NEW.product_id;
    
    -- 检查库存是否足够
    IF current_stock < NEW.quantity THEN
        RAISE EXCEPTION '商品 "{}" 库存不足，当前库存：{}，需要数量：{}', 
            product_name, current_stock, NEW.quantity;
    END IF;
    
    -- 扣减库存
    UPDATE products 
    SET stock_quantity = stock_quantity - NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.product_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 创建触发器：在插入订单项时自动检查和扣减库存
DROP TRIGGER IF EXISTS check_inventory_trigger ON order_items;
CREATE TRIGGER check_inventory_trigger
    BEFORE INSERT ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION check_and_deduct_inventory();

-- 3. 创建函数：订单取消时恢复库存
CREATE OR REPLACE FUNCTION restore_inventory_on_cancel()
RETURNS TRIGGER AS $$
BEGIN
    -- 只有当订单状态从非取消状态变为取消状态时才恢复库存
    IF OLD.status NOT IN ('cancelled', 'timeout_closed') AND 
       NEW.status IN ('cancelled', 'timeout_closed') THEN
        
        -- 恢复该订单所有商品的库存
        UPDATE products 
        SET stock_quantity = stock_quantity + oi.quantity,
            updated_at = NOW()
        FROM order_items oi
        WHERE oi.order_id = NEW.id 
          AND products.id = oi.product_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. 创建触发器：订单取消时恢复库存
DROP TRIGGER IF EXISTS restore_inventory_trigger ON orders;
CREATE TRIGGER restore_inventory_trigger
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION restore_inventory_on_cancel();

-- 5. 创建函数：批量检查购物车商品库存
CREATE OR REPLACE FUNCTION check_cart_inventory(
    cart_items JSONB
)
RETURNS TABLE(
    product_id UUID,
    product_name VARCHAR(200),
    requested_quantity INTEGER,
    available_stock INTEGER,
    is_sufficient BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (item->>'product_id')::UUID as product_id,
        p.name as product_name,
        (item->>'quantity')::INTEGER as requested_quantity,
        p.stock_quantity as available_stock,
        p.stock_quantity >= (item->>'quantity')::INTEGER as is_sufficient
    FROM jsonb_array_elements(cart_items) as item
    JOIN products p ON p.id = (item->>'product_id')::UUID
    WHERE p.is_available = true;
END;
$$ LANGUAGE plpgsql;

-- 6. 添加库存相关索引以提高性能
CREATE INDEX IF NOT EXISTS idx_products_stock_quantity ON products(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- 7. 添加注释
COMMENT ON FUNCTION check_and_deduct_inventory() IS '检查库存并在订单项创建时自动扣减库存';
COMMENT ON FUNCTION restore_inventory_on_cancel() IS '订单取消时恢复库存';
COMMENT ON FUNCTION check_cart_inventory(JSONB) IS '批量检查购物车商品库存状态';
COMMENT ON TRIGGER check_inventory_trigger ON order_items IS '订单项创建时的库存检查触发器';
COMMENT ON TRIGGER restore_inventory_trigger ON orders IS '订单取消时的库存恢复触发器';