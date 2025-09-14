import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, Merchant } from '../../lib/supabase'
import Card from '../../components/ui/Card'
import PageLayout from '../../components/layout/PageLayout'
import { 
  BuildingStorefrontIcon, 
  MapPinIcon, 
  PhoneIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline'
import { getCategoryIcon, getCategoryColors } from '../../constants/categories'

export default function MerchantList() {
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [categories, setCategories] = useState<string[]>([])

  useEffect(() => {
    fetchMerchants()
  }, [])

  const fetchMerchants = async () => {
    try {
      const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching merchants:', error)
        return
      }

      setMerchants(data || [])
      
      // 提取分类
      const uniqueCategories = [...new Set(data?.map(m => m.category) || [])]
      setCategories(uniqueCategories)
    } catch (error) {
      console.error('Error fetching merchants:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredMerchants = merchants.filter(merchant => {
    const matchesSearch = merchant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         merchant.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || merchant.category === selectedCategory
    
    return matchesSearch && matchesCategory
  })

  if (loading) {
    return (
      <PageLayout title="商家列表">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载商家列表...</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout title="商家列表">
        {/* 搜索和筛选 */}
        <div className="mb-6 space-y-4">
          {/* 搜索框 */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="搜索商家名称或描述..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* 分类筛选 */}
          <div className="flex space-x-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              全部
            </button>
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {getCategoryIcon(category)} {category}
              </button>
            ))}
          </div>
        </div>

        {/* 商家列表 */}
        {filteredMerchants.length === 0 ? (
          <div className="text-center py-12">
            <BuildingStorefrontIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">暂无商家</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || selectedCategory !== 'all' ? '没有找到符合条件的商家' : '还没有商家入驻'}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredMerchants.map(merchant => (
              <Link key={merchant.id} to={`/merchant/${merchant.id}`}>
                <Card hover className="h-full">
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
                        <BuildingStorefrontIcon className="h-8 w-8 text-blue-600" />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-medium text-gray-900 truncate">
                        {merchant.name}
                      </h3>
                      
                      <div className="flex items-center mt-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          getCategoryColors(merchant.category).bg
                        } ${
                          getCategoryColors(merchant.category).text
                        }`}>
                          {getCategoryIcon(merchant.category)} {merchant.category}
                        </span>
                      </div>
                      
                      {merchant.description && (
                        <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                          {merchant.description}
                        </p>
                      )}
                      
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center text-sm text-gray-500">
                          <MapPinIcon className="h-4 w-4 mr-1" />
                          <span className="truncate">{merchant.address}</span>
                        </div>
                        
                        <div className="flex items-center text-sm text-gray-500">
                          <PhoneIcon className="h-4 w-4 mr-1" />
                          <span>{merchant.phone}</span>
                        </div>
                      </div>

                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
    </PageLayout>
  )
}