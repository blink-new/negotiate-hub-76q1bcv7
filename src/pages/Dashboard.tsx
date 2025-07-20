import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Plus, 
  Clock, 
  CheckCircle, 
  XCircle, 
  DollarSign,
  TrendingUp,
  Users,
  Calendar
} from 'lucide-react'
import blink from '@/blink/client'

interface User {
  id: string
  email: string
  displayName?: string
  role?: string
}

interface Negotiation {
  id: string
  title: string
  description: string
  initiatorRole: string
  counterpartEmail: string
  status: string
  createdAt: string
  expiresAt?: string
}

interface Deal {
  id: string
  negotiationId: string
  agreedPrice: number
  platformFee: number
  finalPrice: number
  validUntil: string
  status: string
  createdAt: string
}

interface DashboardProps {
  user: User | null
}

export default function Dashboard({ user }: DashboardProps) {
  const [negotiations, setNegotiations] = useState<Negotiation[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    completed: 0,
    totalValue: 0
  })

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Load negotiations where user is involved (as initiator)
      const initiatorNegotiations = await blink.db.negotiations.list({
        where: { initiatorId: user!.id },
        orderBy: { createdAt: 'desc' }
      })
      
      // Load negotiations where user is involved (as counterpart)
      const counterpartNegotiations = await blink.db.negotiations.list({
        where: { counterpartId: user!.id },
        orderBy: { createdAt: 'desc' }
      })
      
      // Combine and deduplicate negotiations
      const allNegotiations = [...initiatorNegotiations, ...counterpartNegotiations]
      const uniqueNegotiations = allNegotiations.filter((negotiation, index, self) => 
        index === self.findIndex(n => n.id === negotiation.id)
      )
      
      // Load deals where user is involved (as buyer)
      const buyerDeals = await blink.db.deals.list({
        where: { buyerId: user!.id },
        orderBy: { createdAt: 'desc' }
      })
      
      // Load deals where user is involved (as seller)
      const sellerDeals = await blink.db.deals.list({
        where: { sellerId: user!.id },
        orderBy: { createdAt: 'desc' }
      })
      
      // Combine and deduplicate deals
      const allDeals = [...buyerDeals, ...sellerDeals]
      const uniqueDeals = allDeals.filter((deal, index, self) => 
        index === self.findIndex(d => d.id === deal.id)
      )

      setNegotiations(uniqueNegotiations)
      setDeals(uniqueDeals)

      // Calculate stats
      const activeCount = uniqueNegotiations.filter(n => n.status === 'active').length
      const completedCount = uniqueDeals.filter(d => d.status === 'executed').length
      const totalValue = uniqueDeals.reduce((sum, deal) => sum + Number(deal.finalPrice), 0)

      setStats({
        total: uniqueNegotiations.length,
        active: activeCount,
        completed: completedCount,
        totalValue
      })
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadDashboardData()
    }
  }, [user, loadDashboardData])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>
      case 'active':
        return <Badge variant="default">Active</Badge>
      case 'completed':
        return <Badge variant="outline" className="text-green-600 border-green-600">Completed</Badge>
      case 'expired':
        return <Badge variant="destructive">Expired</Badge>
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Welcome to NegotiateHub</CardTitle>
            <CardDescription>Please sign in to access your dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => blink.auth.login()} className="w-full">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-1">
                Welcome back, {user.displayName || user.email.split('@')[0]}!
              </p>
            </div>
            <Button asChild>
              <Link to="/create">
                <Plus className="h-4 w-4 mr-2" />
                New Negotiation
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Negotiations</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active}</div>
              <p className="text-xs text-muted-foreground">In progress</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
              <p className="text-xs text-muted-foreground">Successful deals</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</div>
              <p className="text-xs text-muted-foreground">Deals closed</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="negotiations" className="space-y-6">
          <TabsList>
            <TabsTrigger value="negotiations">Negotiations</TabsTrigger>
            <TabsTrigger value="deals">Completed Deals</TabsTrigger>
          </TabsList>

          <TabsContent value="negotiations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Negotiations</CardTitle>
                <CardDescription>
                  Track all your active and pending negotiations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-600 mt-2">Loading negotiations...</p>
                  </div>
                ) : negotiations.length === 0 ? (
                  <div className="text-center py-8">
                    <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No negotiations yet</h3>
                    <p className="text-gray-600 mb-4">Start your first negotiation to see it here</p>
                    <Button asChild>
                      <Link to="/create">Create Negotiation</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {negotiations.map((negotiation) => (
                      <div key={negotiation.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-medium text-gray-900">{negotiation.title}</h3>
                              {getStatusBadge(negotiation.status)}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{negotiation.description}</p>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <span>Role: {negotiation.initiatorId === user.id ? negotiation.initiatorRole : (negotiation.initiatorRole === 'buyer' ? 'seller' : 'buyer')}</span>
                              <span>•</span>
                              <span>With: {negotiation.counterpartEmail}</span>
                              <span>•</span>
                              <span>Created: {formatDate(negotiation.createdAt)}</span>
                              {negotiation.expiresAt && (
                                <>
                                  <span>•</span>
                                  <span>Expires: {formatDate(negotiation.expiresAt)}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/negotiation/${negotiation.id}`}>View Details</Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deals" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Completed Deals</CardTitle>
                <CardDescription>
                  View all your successfully negotiated deals
                </CardDescription>
              </CardHeader>
              <CardContent>
                {deals.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No completed deals yet</h3>
                    <p className="text-gray-600">Your successful negotiations will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {deals.map((deal) => (
                      <div key={deal.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-medium text-gray-900">Deal #{deal.id.slice(-8)}</h3>
                              {getStatusBadge(deal.status)}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">Agreed Price:</span>
                                <p className="font-medium">{formatCurrency(deal.agreedPrice)}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">Platform Fee:</span>
                                <p className="font-medium">{formatCurrency(deal.platformFee)}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">Final Price:</span>
                                <p className="font-medium">{formatCurrency(deal.finalPrice)}</p>
                              </div>
                              <div>
                                <span className="text-gray-500">Valid Until:</span>
                                <p className="font-medium">{formatDate(deal.validUntil)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}