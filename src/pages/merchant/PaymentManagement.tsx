import React, { useState, useEffect } from 'react';
import { QrCode, Upload, Trash2, Eye, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Loading from '../../components/ui/Loading';
import { toast } from 'sonner';

interface Merchant {
  id: string;
  name: string;
  payment_qr_code: string;
}

interface Props {
  merchant: Merchant | null;
}

export default function PaymentManagement({ merchant }: Props) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<string>('');
  const [currentQRCode, setCurrentQRCode] = useState<string>('');

  useEffect(() => {
    if (merchant?.payment_qr_code) {
      setCurrentQRCode(merchant.payment_qr_code);
    }
  }, [merchant]);

  const uploadQRCode = async (file: File): Promise<string> => {
    try {
      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        throw new Error('请选择图片文件（JPG、PNG、GIF等格式）');
      }

      // 验证文件大小 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('图片大小不能超过10MB');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `qr-${merchant?.id}-${Date.now()}.${fileExt}`;
      const filePath = `payment-qr/${fileName}`;

      console.log('开始上传收款码:', { fileName, filePath, fileSize: file.size });

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file);

      if (uploadError) {
        console.error('收款码上传失败:', uploadError);
        throw new Error(`上传失败: ${uploadError.message}`);
      }

      const { data } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      console.log('收款码上传成功:', data.publicUrl);
      return data.publicUrl;
    } catch (error) {
      console.error('uploadQRCode error:', error);
      throw error;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !merchant?.id) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    // 验证文件大小 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('图片大小不能超过5MB');
      return;
    }

    setUploading(true);
    
    try {
      // 上传图片
      const imageUrl = await uploadQRCode(file);
      
      // 更新商家信息
      const { error } = await supabase
        .from('merchants')
        .update({ payment_qr_code: imageUrl })
        .eq('id', merchant.id);

      if (error) {
        console.error('更新商家收款码失败:', error);
        throw new Error(`保存失败: ${error.message}`);
      }
      
      setCurrentQRCode(imageUrl);
      toast.success('收款码上传成功');
    } catch (error) {
      console.error('Error uploading QR code:', error);
      const errorMessage = error instanceof Error ? error.message : '上传失败，请重试';
      toast.error(errorMessage);
    } finally {
      setUploading(false);
      // 清空文件输入
      e.target.value = '';
    }
  };

  const handleDeleteQRCode = async () => {
    if (!merchant?.id) return;
    
    if (!confirm('确定要删除当前收款码吗？删除后顾客将无法完成支付。')) return;
    
    setLoading(true);
    
    try {
      const { error } = await supabase
        .from('merchants')
        .update({ payment_qr_code: null })
        .eq('id', merchant.id);

      if (error) throw error;
      
      setCurrentQRCode('');
      toast.success('收款码删除成功');
    } catch (error) {
      console.error('Error deleting QR code:', error);
      toast.error('删除失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = (imageUrl: string) => {
    setPreviewImage(imageUrl);
    setShowPreviewModal(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">收款码管理</h1>
        <p className="text-gray-600">设置您的收款二维码，顾客扫码支付时会显示此二维码</p>
      </div>

      {/* Current QR Code */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">当前收款码</h2>
        
        {currentQRCode ? (
          <div className="space-y-4">
            {/* QR Code Display */}
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="flex-shrink-0">
                <div className="w-48 h-48 bg-white border-2 border-gray-200 rounded-lg overflow-hidden shadow-sm">
                  <img
                    src={currentQRCode}
                    alt="收款码"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
              
              <div className="flex-1 space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-800">收款码已设置</span>
                  </div>
                  <p className="text-sm text-green-700">
                    顾客下单后会看到此收款码，请确保二维码清晰可扫描
                  </p>
                </div>
                
                <div className="space-y-3">
                  <h3 className="font-medium text-gray-900">使用说明：</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 顾客下单后会显示此收款码</li>
                    <li>• 顾客需要扫码支付并在备注中填写订单验证码</li>
                    <li>• 您可以根据验证码确认收款并处理订单</li>
                    <li>• 建议使用支付宝、微信等常用支付方式的收款码</li>
                  </ul>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => handlePreview(currentQRCode)}
                    className="text-blue-600 border-blue-200"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    预览
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={handleDeleteQRCode}
                    disabled={loading}
                    className="text-red-600 border-red-200"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    删除
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <QrCode className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">未设置收款码</h3>
            <p className="text-gray-600 mb-6">
              请上传您的收款二维码，顾客下单后会显示此二维码进行支付
            </p>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-2 mb-2">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <span className="font-medium text-yellow-800">重要提醒</span>
              </div>
              <p className="text-sm text-yellow-700">
                没有收款码的情况下，顾客无法完成支付流程，请尽快上传
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Upload Section */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {currentQRCode ? '更换收款码' : '上传收款码'}
        </h2>
        
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
              id="qr-upload"
            />
            
            <label
              htmlFor="qr-upload"
              className={`cursor-pointer ${uploading ? 'cursor-not-allowed' : ''}`}
            >
              {uploading ? (
                <div className="space-y-2">
                  <Loading />
                  <p className="text-sm text-gray-600">上传中...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                  <div>
                    <p className="text-lg font-medium text-gray-900">
                      点击选择图片文件
                    </p>
                    <p className="text-sm text-gray-600">
                      支持 JPG、PNG 格式，文件大小不超过 5MB
                    </p>
                  </div>
                </div>
              )}
            </label>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">收款码要求：</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 图片清晰，二维码完整无遮挡</li>
              <li>• 建议使用支付宝、微信支付等主流支付方式</li>
              <li>• 确保收款账户信息正确</li>
              <li>• 定期检查收款码是否有效</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Payment Tips */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">支付流程说明</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-lg font-bold text-blue-600">1</span>
            </div>
            <h3 className="font-medium text-gray-900 mb-2">顾客下单</h3>
            <p className="text-sm text-gray-600">
              顾客选择商品并填写收货信息后确认订单
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-lg font-bold text-blue-600">2</span>
            </div>
            <h3 className="font-medium text-gray-900 mb-2">扫码支付</h3>
            <p className="text-sm text-gray-600">
              系统显示您的收款码和订单验证码，顾客扫码支付
            </p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-lg font-bold text-blue-600">3</span>
            </div>
            <h3 className="font-medium text-gray-900 mb-2">确认收款</h3>
            <p className="text-sm text-gray-600">
              您根据验证码确认收款，然后处理订单
            </p>
          </div>
        </div>
      </Card>

      {/* Preview Modal */}
      <Modal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title="收款码预览"
      >
        <div className="text-center">
          <div className="w-80 h-80 bg-white border border-gray-200 rounded-lg overflow-hidden mx-auto mb-4">
            <img
              src={previewImage}
              alt="收款码预览"
              className="w-full h-full object-contain"
            />
          </div>
          <p className="text-sm text-gray-600">
            这是顾客在支付页面看到的收款码
          </p>
        </div>
      </Modal>
    </div>
  );
}