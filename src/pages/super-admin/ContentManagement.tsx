import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Image as ImageIcon, 
  FileText, 
  Eye, 
  EyeOff,
  Calendar,
  Upload,
  X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Loading from '../../components/ui/Loading';
import Empty from '../../components/Empty';
import { toast } from 'sonner';

interface Banner {
  id: string;
  title: string;
  image_url: string;
  link_url?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  is_active: boolean;
  target_roles?: string[];
  announcement_type?: string;
  publisher_name?: string;
  valid_until?: string;
  created_at: string;
}

interface Props {
  onUpdate: () => void;
}

export default function ContentManagement({ onUpdate }: Props) {
  const [activeTab, setActiveTab] = useState<'banners' | 'announcements'>('banners');
  const [banners, setBanners] = useState<Banner[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBannerModal, setShowBannerModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Banner form state
  const [bannerForm, setBannerForm] = useState({
    title: '',
    image_url: '',
    link_url: '',
    is_active: true,
    sort_order: 0
  });

  // Announcement form state
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    is_active: true,
    target_roles: ['customer', 'merchant'] as string[],
    announcement_type: 'general',
    publisher_name: '系统管理员',
    valid_until: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // 获取轮播图
      const { data: bannersData, error: bannersError } = await supabase
        .from('banners')
        .select('*')
        .order('sort_order', { ascending: true });

      if (bannersError) throw bannersError;
      setBanners(bannersData || []);

      // 获取公告
      const { data: announcementsData, error: announcementsError } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (announcementsError) throw announcementsError;
      setAnnouncements(announcementsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    
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
      const fileName = `banner_${Date.now()}.${fileExt}`;
      const filePath = `banners/${fileName}`;

      console.log('开始上传横幅图片:', { fileName, filePath, fileSize: file.size });

      // 首先检查存储桶是否存在
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      if (bucketsError) {
        console.error('检查存储桶失败:', bucketsError);
        throw new Error('存储服务连接失败，请稍后重试');
      }

      const imagesBucket = buckets.find(bucket => bucket.name === 'images');
      if (!imagesBucket) {
        console.error('images存储桶不存在');
        throw new Error('存储配置错误：images存储桶不存在，请联系管理员');
      }

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file);

      if (uploadError) {
        console.error('横幅图片上传失败:', uploadError);
        
        // 检查是否是JSON错误（通常表示存储桶配置问题）
        if (uploadError.message.includes('application/json') || 
            uploadError.message.includes('mime type') ||
            uploadError.message.includes('Bucket not found')) {
          throw new Error('存储配置错误，请联系管理员检查存储桶设置');
        }
        
        // 检查是否是权限错误
        if (uploadError.message.includes('policy') || 
            uploadError.message.includes('permission') ||
            uploadError.message.includes('RLS')) {
          throw new Error('存储权限错误，请联系管理员检查访问策略');
        }
        
        // 检查是否是文件大小或类型错误
        if (uploadError.message.includes('file size') || 
            uploadError.message.includes('mime')) {
          throw new Error('文件格式或大小不符合要求');
        }
        
        throw new Error(`上传失败: ${uploadError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      setBannerForm(prev => ({ ...prev, image_url: publicUrl }));
      console.log('横幅图片上传成功:', publicUrl);
      toast.success('图片上传成功');
    } catch (error) {
      console.error('Error uploading image:', error);
      let errorMessage = '图片上传失败';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // 为特定错误提供更详细的解决方案
        if (error.message.includes('存储配置错误')) {
          errorMessage += '\n\n解决方案：\n1. 检查Supabase Storage配置\n2. 确认images存储桶已创建\n3. 联系技术支持';
        } else if (error.message.includes('权限错误')) {
          errorMessage += '\n\n解决方案：\n1. 检查RLS策略配置\n2. 确认用户权限设置\n3. 联系技术支持';
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleBannerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingBanner) {
        // 更新轮播图
        const { error } = await supabase
          .from('banners')
          .update(bannerForm)
          .eq('id', editingBanner.id);

        if (error) throw error;
        toast.success('轮播图更新成功');
      } else {
        // 创建轮播图
        const { error } = await supabase
          .from('banners')
          .insert([bannerForm]);

        if (error) throw error;
        toast.success('轮播图创建成功');
      }

      setShowBannerModal(false);
      setEditingBanner(null);
      setBannerForm({
        title: '',
        image_url: '',
        link_url: '',
        is_active: true,
        sort_order: 0
      });
      fetchData();
      onUpdate();
    } catch (error) {
      console.error('Error saving banner:', error);
      toast.error('保存轮播图失败');
    } finally {
      setSaving(false);
    }
  };

  const handleAnnouncementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 验证表单
    if (!announcementForm.title.trim()) {
      toast.error('请输入公告标题');
      return;
    }
    
    if (!announcementForm.content.trim()) {
      toast.error('请输入公告内容');
      return;
    }
    
    if (announcementForm.target_roles.length === 0) {
      toast.error('请至少选择一个发布对象');
      return;
    }
    
    setSaving(true);

    try {
      const announcementData = {
        title: announcementForm.title.trim(),
        content: announcementForm.content.trim(),
        is_active: announcementForm.is_active,
        target_roles: announcementForm.target_roles,
        announcement_type: announcementForm.announcement_type,
        publisher_name: announcementForm.publisher_name,
        valid_until: announcementForm.valid_until || null
      };
      
      if (editingAnnouncement) {
        // 更新公告
        const { error } = await supabase
          .from('announcements')
          .update(announcementData)
          .eq('id', editingAnnouncement.id);

        if (error) {
          console.error('更新公告失败:', error);
          throw new Error(`更新失败: ${error.message}`);
        }
        toast.success('公告更新成功');
      } else {
        // 创建公告
        const { error } = await supabase
          .from('announcements')
          .insert([announcementData]);

        if (error) {
          console.error('创建公告失败:', error);
          throw new Error(`创建失败: ${error.message}`);
        }
        toast.success('公告发布成功');
      }

      setShowAnnouncementModal(false);
      setEditingAnnouncement(null);
      setAnnouncementForm({
        title: '',
        content: '',
        is_active: true,
        target_roles: ['customer', 'merchant'],
        announcement_type: 'general',
        publisher_name: '系统管理员',
        valid_until: ''
      });
      fetchData();
      onUpdate();
    } catch (error) {
      console.error('Error saving announcement:', error);
      const errorMessage = error instanceof Error ? error.message : '保存公告失败，请重试';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type: 'banner' | 'announcement', id: string) => {
    if (!confirm('确定要删除吗？此操作不可恢复。')) return;
    
    setDeleting(id);
    
    try {
      const table = type === 'banner' ? 'banners' : 'announcements';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success(`${type === 'banner' ? '轮播图' : '公告'}删除成功`);
      fetchData();
      onUpdate();
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('删除失败');
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleStatus = async (type: 'banner' | 'announcement', id: string, isActive: boolean) => {
    try {
      const table = type === 'banner' ? 'banners' : 'announcements';
      const { error } = await supabase
        .from(table)
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
      
      toast.success(`${type === 'banner' ? '轮播图' : '公告'}状态更新成功`);
      fetchData();
      onUpdate();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('状态更新失败');
    }
  };

  const openBannerModal = (banner?: Banner) => {
    if (banner) {
      setEditingBanner(banner);
      setBannerForm({
        title: banner.title,
        image_url: banner.image_url,
        link_url: banner.link_url || '',
        is_active: banner.is_active,
        sort_order: banner.sort_order
      });
    } else {
      setEditingBanner(null);
      setBannerForm({
        title: '',
        image_url: '',
        link_url: '',
        is_active: true,
        sort_order: banners.length
      });
    }
    setShowBannerModal(true);
  };

  const openAnnouncementModal = (announcement?: Announcement) => {
    if (announcement) {
      setEditingAnnouncement(announcement);
      setAnnouncementForm({
        title: announcement.title,
        content: announcement.content,
        is_active: announcement.is_active,
        target_roles: announcement.target_roles || ['customer', 'merchant'],
        announcement_type: announcement.announcement_type || 'general',
        publisher_name: announcement.publisher_name || '系统管理员',
        valid_until: announcement.valid_until || ''
      });
    } else {
      setEditingAnnouncement(null);
      setAnnouncementForm({
        title: '',
        content: '',
        is_active: true,
        target_roles: ['customer', 'merchant'],
        announcement_type: 'general',
        publisher_name: '系统管理员',
        valid_until: ''
      });
    }
    setShowAnnouncementModal(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">内容管理</h1>
          <p className="text-gray-600">管理平台轮播图和公告内容</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('banners')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'banners'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ImageIcon className="w-4 h-4 inline mr-2" />
            轮播图管理 ({banners.length})
          </button>
          <button
            onClick={() => setActiveTab('announcements')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'announcements'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            公告管理 ({announcements.length})
          </button>
        </nav>
      </div>

      {/* Banners Tab */}
      {activeTab === 'banners' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">轮播图管理</h2>
              <p className="text-sm text-gray-600">管理首页轮播图，建议尺寸 1200x400 像素</p>
            </div>
            <Button onClick={() => openBannerModal()}>
              <Plus className="w-4 h-4 mr-2" />
              添加轮播图
            </Button>
          </div>

          {banners.length === 0 ? (
            <Empty
              icon={ImageIcon}
              title="暂无轮播图"
              description="还没有添加轮播图，点击上方按钮添加第一个轮播图"
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {banners.map((banner) => (
                <Card key={banner.id} className="overflow-hidden">
                  <div className="aspect-[3/1] relative">
                    <img
                      src={banner.image_url}
                      alt={banner.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 flex space-x-2">
                      <button
                        onClick={() => handleToggleStatus('banner', banner.id, !banner.is_active)}
                        className={`p-1 rounded-full ${
                          banner.is_active
                            ? 'bg-green-100 text-green-600'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {banner.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">{banner.title}</h3>
                        {banner.link_url && (
                          <p className="text-sm text-blue-600 truncate">{banner.link_url}</p>
                        )}
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        banner.is_active
                          ? 'text-green-600 bg-green-100'
                          : 'text-gray-600 bg-gray-100'
                      }`}>
                        {banner.is_active ? '显示中' : '已隐藏'}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(banner.created_at)}</span>
                      </div>
                      <span>排序: {banner.sort_order}</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openBannerModal(banner)}
                        className="text-blue-600 border-blue-200"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        编辑
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete('banner', banner.id)}
                        disabled={deleting === banner.id}
                        className="text-red-600 border-red-200"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        {deleting === banner.id ? '删除中...' : '删除'}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Announcements Tab */}
      {activeTab === 'announcements' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">公告管理</h2>
              <p className="text-sm text-gray-600">管理平台公告和通知信息</p>
            </div>
            <Button onClick={() => openAnnouncementModal()}>
              <Plus className="w-4 h-4 mr-2" />
              添加公告
            </Button>
          </div>

          {announcements.length === 0 ? (
            <Empty
              icon={FileText}
              title="暂无公告"
              description="还没有发布公告，点击上方按钮添加第一个公告"
            />
          ) : (
            <div className="space-y-4">
              {announcements.map((announcement) => (
                <Card key={announcement.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{announcement.title}</h3>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          announcement.is_active
                            ? 'text-green-600 bg-green-100'
                            : 'text-gray-600 bg-gray-100'
                        }`}>
                          {announcement.is_active ? '✓ 已发布' : '○ 草稿'}
                        </span>
                        {announcement.announcement_type && (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            announcement.announcement_type === 'urgent' ? 'text-red-600 bg-red-100' :
                            announcement.announcement_type === 'maintenance' ? 'text-orange-600 bg-orange-100' :
                            announcement.announcement_type === 'promotion' ? 'text-purple-600 bg-purple-100' :
                            'text-blue-600 bg-blue-100'
                          }`}>
                            {announcement.announcement_type === 'urgent' ? '🚨 紧急' :
                             announcement.announcement_type === 'maintenance' ? '🔧 维护' :
                             announcement.announcement_type === 'promotion' ? '🎉 优惠' : '📢 普通'}
                          </span>
                        )}
                      </div>
                      
                      {/* 目标角色和发布者信息 */}
                      <div className="flex items-center space-x-4 mb-2 text-xs text-gray-500">
                        {announcement.target_roles && announcement.target_roles.length > 0 && (
                          <div className="flex items-center space-x-1">
                            <span>发布对象:</span>
                            <div className="flex space-x-1">
                              {announcement.target_roles.map(role => (
                                <span key={role} className="px-1.5 py-0.5 bg-gray-100 rounded text-xs">
                                  {role === 'customer' ? '顾客' : role === 'merchant' ? '商家' : role}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {announcement.publisher_name && (
                          <div className="flex items-center space-x-1">
                            <span>发布者:</span>
                            <span className="font-medium">{announcement.publisher_name}</span>
                          </div>
                        )}
                        {announcement.valid_until && (
                          <div className="flex items-center space-x-1">
                            <span>有效期至:</span>
                            <span className="font-medium">{formatDate(announcement.valid_until)}</span>
                          </div>
                        )}
                      </div>
                      
                      <p className="text-gray-600 line-clamp-3 whitespace-pre-wrap">{announcement.content}</p>
                      <div className="mt-2 text-xs text-gray-500">
                        字数: {announcement.content.length} 字
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => handleToggleStatus('announcement', announcement.id, !announcement.is_active)}
                        className={`p-2 rounded-lg transition-colors ${
                          announcement.is_active
                            ? 'bg-green-100 text-green-600 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title={announcement.is_active ? '隐藏公告' : '发布公告'}
                      >
                        {announcement.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1 text-sm text-gray-500">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(announcement.created_at)}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAnnouncementModal(announcement)}
                        className="text-blue-600 border-blue-200"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        编辑
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete('announcement', announcement.id)}
                        disabled={deleting === announcement.id}
                        className="text-red-600 border-red-200"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        {deleting === announcement.id ? '删除中...' : '删除'}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Banner Modal */}
      <Modal
        isOpen={showBannerModal}
        onClose={() => setShowBannerModal(false)}
        title={editingBanner ? '编辑轮播图' : '添加轮播图'}
      >
        <form onSubmit={handleBannerSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              标题 *
            </label>
            <Input
              value={bannerForm.title}
              onChange={(e) => setBannerForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="请输入轮播图标题"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              图片 *
            </label>
            <div className="space-y-3">
              {bannerForm.image_url && (
                <div className="relative">
                  <img
                    src={bannerForm.image_url}
                    alt="预览"
                    className="w-full h-32 object-cover rounded-lg border"
                  />
                  <button
                    type="button"
                    onClick={() => setBannerForm(prev => ({ ...prev, image_url: '' }))}
                    className="absolute top-2 right-2 p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="flex items-center space-x-3">
                <Input
                  value={bannerForm.image_url}
                  onChange={(e) => setBannerForm(prev => ({ ...prev, image_url: e.target.value }))}
                  placeholder="请输入图片URL或上传图片"
                  required
                />
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(file);
                    }}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploading}
                    className="whitespace-nowrap"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading ? '上传中...' : '上传图片'}
                  </Button>
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              链接地址
            </label>
            <Input
              value={bannerForm.link_url}
              onChange={(e) => setBannerForm(prev => ({ ...prev, link_url: e.target.value }))}
              placeholder="点击轮播图跳转的链接地址（可选）"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              排序
            </label>
            <Input
              type="number"
              value={bannerForm.sort_order}
              onChange={(e) => setBannerForm(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
              placeholder="排序数字，数字越小越靠前"
              min="0"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="banner-active"
              checked={bannerForm.is_active}
              onChange={(e) => setBannerForm(prev => ({ ...prev, is_active: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="banner-active" className="text-sm text-gray-700">
              立即显示
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowBannerModal(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={saving || !bannerForm.title || !bannerForm.image_url}>
              {saving ? '保存中...' : (editingBanner ? '更新' : '创建')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Announcement Modal */}
      <Modal
        isOpen={showAnnouncementModal}
        onClose={() => setShowAnnouncementModal(false)}
        title={editingAnnouncement ? '编辑公告' : '添加公告'}
      >
        <form onSubmit={handleAnnouncementSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              公告标题 *
            </label>
            <Input
              value={announcementForm.title}
              onChange={(e) => setAnnouncementForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="请输入公告标题"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              公告内容 *
            </label>
            <textarea
              value={announcementForm.content}
              onChange={(e) => setAnnouncementForm(prev => ({ ...prev, content: e.target.value }))}
              placeholder="请输入公告内容"
              rows={6}
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              发布对象 *
            </label>
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={announcementForm.target_roles.includes('customer')}
                  onChange={(e) => {
                    const roles = e.target.checked 
                      ? [...announcementForm.target_roles.filter(r => r !== 'customer'), 'customer']
                      : announcementForm.target_roles.filter(r => r !== 'customer');
                    setAnnouncementForm(prev => ({ ...prev, target_roles: roles }));
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">顾客</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={announcementForm.target_roles.includes('merchant')}
                  onChange={(e) => {
                    const roles = e.target.checked 
                      ? [...announcementForm.target_roles.filter(r => r !== 'merchant'), 'merchant']
                      : announcementForm.target_roles.filter(r => r !== 'merchant');
                    setAnnouncementForm(prev => ({ ...prev, target_roles: roles }));
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">商家</span>
              </label>
            </div>
            {announcementForm.target_roles.length === 0 && (
              <p className="text-sm text-red-600 mt-1">请至少选择一个发布对象</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              公告类型
            </label>
            <select
              value={announcementForm.announcement_type}
              onChange={(e) => setAnnouncementForm(prev => ({ ...prev, announcement_type: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="general">普通公告</option>
              <option value="urgent">紧急公告</option>
              <option value="maintenance">维护通知</option>
              <option value="promotion">优惠活动</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              发布者
            </label>
            <Input
              value={announcementForm.publisher_name}
              onChange={(e) => setAnnouncementForm(prev => ({ ...prev, publisher_name: e.target.value }))}
              placeholder="发布者名称"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              有效期至
            </label>
            <Input
              type="datetime-local"
              value={announcementForm.valid_until}
              onChange={(e) => setAnnouncementForm(prev => ({ ...prev, valid_until: e.target.value }))}
              placeholder="留空表示永久有效"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="announcement-active"
              checked={announcementForm.is_active}
              onChange={(e) => setAnnouncementForm(prev => ({ ...prev, is_active: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="announcement-active" className="text-sm text-gray-700">
              立即发布
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAnnouncementModal(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={saving || !announcementForm.title || !announcementForm.content || announcementForm.target_roles.length === 0}>
              {saving ? '保存中...' : (editingAnnouncement ? '更新' : '发布')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}