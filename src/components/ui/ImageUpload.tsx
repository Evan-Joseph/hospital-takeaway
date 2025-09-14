import React, { useState, useRef } from 'react';
import { Upload, X, Eye, AlertCircle } from 'lucide-react';
import Button from './Button';
import Loading from './Loading';
import Modal from './Modal';
import { toast } from 'sonner';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  onRemove?: () => void;
  disabled?: boolean;
  maxSize?: number; // MB
  accept?: string;
  className?: string;
  placeholder?: string;
  showPreview?: boolean;
  uploadPath?: string; // Supabase storage path prefix
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  value,
  onChange,
  onRemove,
  disabled = false,
  maxSize = 10,
  accept = 'image/*',
  className = '',
  placeholder = '点击选择图片文件',
  showPreview = true,
  uploadPath = 'uploads'
}) => {
  const [uploading, setUploading] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件（JPG、PNG、GIF等格式）');
      return;
    }

    // 验证文件大小
    if (file.size > maxSize * 1024 * 1024) {
      toast.error(`图片大小不能超过${maxSize}MB`);
      return;
    }

    setUploading(true);
    
    try {
      // 这里应该调用实际的上传函数
      // 为了演示，我们创建一个本地预览URL
      const previewUrl = URL.createObjectURL(file);
      
      // 模拟上传延迟
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onChange(previewUrl);
      toast.success('图片上传成功');
    } catch (error) {
      console.error('图片上传失败:', error);
      toast.error('图片上传失败，请重试');
    } finally {
      setUploading(false);
      // 清空文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    if (onRemove) {
      onRemove();
    } else {
      onChange('');
    }
    toast.success('图片已移除');
  };

  const handlePreview = () => {
    if (value) {
      setShowPreviewModal(true);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 当前图片显示 */}
      {value && (
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-24 h-24 bg-gray-100 border-2 border-gray-200 rounded-lg overflow-hidden">
              <img
                src={value}
                alt="预览"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          
          <div className="flex-1 space-y-2">
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1 text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium">图片已上传</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {showPreview && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePreview}
                  className="text-blue-600 border-blue-200"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  预览
                </Button>
              )}
              
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemove}
                disabled={disabled}
                className="text-red-600 border-red-200"
              >
                <X className="w-4 h-4 mr-1" />
                移除
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 上传区域 */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          disabled={disabled || uploading}
          className="hidden"
        />
        
        {uploading ? (
          <div className="space-y-2">
            <Loading />
            <p className="text-sm text-gray-600">上传中...</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="w-8 h-8 text-gray-400 mx-auto" />
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="text-blue-600 hover:text-blue-500 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {value ? '更换图片' : placeholder}
              </button>
              <p className="text-xs text-gray-500 mt-1">
                支持 JPG、PNG、GIF 格式，文件大小不超过 {maxSize}MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 使用提示 */}
      {!value && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">上传建议：</p>
              <ul className="space-y-1 text-xs">
                <li>• 建议使用清晰、高质量的图片</li>
                <li>• 图片比例建议为 1:1 或 4:3</li>
                <li>• 避免使用过于复杂的背景</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 预览模态框 */}
      {showPreview && (
        <Modal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          title="图片预览"
        >
          <div className="max-w-lg mx-auto">
            {value && (
              <img
                src={value}
                alt="预览"
                className="w-full h-auto rounded-lg"
              />
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ImageUpload;