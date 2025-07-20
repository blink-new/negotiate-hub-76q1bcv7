import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { 
  ArrowLeft, 
  ExternalLink, 
  FileText, 
  DollarSign, 
  Clock,
  CheckCircle,
  AlertCircle,
  Calculator
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
  itemLink: string
  attachmentUrl: string
  initiatorId: string
  initiatorRole: string
  counterpartEmail: string
  counterpartId?: string
  status: string
  createdAt: string
  expiresAt: string
}

interface PriceRange {
  id: string
  negotiationId: string
  userId: string
  userRole: string
  minPrice: number
  maxPrice: number
  submittedAt: string
}

interface Deal {
  id: string
  negotiationId: string
  buyerId: string
  sellerId: string
  agreedPrice: number
  platformFee: number
  finalPrice: number
  validUntil: string
  status: string
  createdAt: string
}

interface NegotiationDetailsProps {
  user: User | null
}

export default function NegotiationDetails({ user }: NegotiationDetailsProps) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  
  const [negotiation, setNegotiation] = useState<Negotiation | null>(null)
  const [priceRanges, setPriceRanges] = useState<PriceRange[]>([])
  const [deal, setDeal] = useState<Deal | null>(null)
  const [loading, setLoading] = useState(true)
  const [submittingRange, setSubmittingRange] = useState(false)
  const [priceRange, setPriceRange] = useState({ min: '', max: '' })

  const loadNegotiationData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Load negotiation
      const negotiations = await blink.db.negotiations.list({
        where: { id: id! }
      })
      
      if (negotiations.length === 0) {
        toast({
          title: 'Negotiation not found',
          description: 'The negotiation you are looking for does not exist',
          variant: 'destructive'
        })
        navigate('/dashboard')
        return
      }

      const neg = negotiations[0]
      setNegotiation(neg)

      // If user is the counterpart and hasn't been linked yet, link them
      if (user && neg.counterpartEmail === user.email && !neg.counterpartId) {
        await blink.db.negotiations.update(neg.id, {
          counterpartId: user.id
        })
        
        // Create notification for the initiator
        try {
          await blink.db.notifications.create({
            id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId: neg.initiatorId,
            negotiationId: neg.id,
            type: 'counterpart_joined',
            title: 'Counterpart Joined',
            message: `${user.displayName || user.email} has joined the negotiation: ${neg.title}`,
            readStatus: 0
          })
        } catch (notifError) {
          console.error('Error creating notification:', notifError)
          // Don't fail the whole operation if notification creation fails
        }
        
        // Update local state
        setNegotiation(prev => prev ? { ...prev, counterpartId: user.id } : null)
      }

      // Load price ranges
      const ranges = await blink.db.priceRanges.list({
        where: { negotiationId: id! }
      })
      setPriceRanges(ranges)

      // Load deal if exists
      const deals = await blink.db.deals.list({
        where: { negotiationId: id! }
      })
      if (deals.length > 0) {
        setDeal(deals[0])
      }

    } catch (error) {
      console.error('Error loading negotiation:', error)
      toast({
        title: 'Error',
        description: 'Failed to load negotiation details',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [id, navigate, toast, user])

  useEffect(() => {
    if (id && user) {
      loadNegotiationData()
    }
  }, [id, user, loadNegotiationData])

  const calculatePlatformFee = (amount: number, userNegotiationCount: number = 0) => {
    // Volume-based sliding scale starting at 1%
    let feePercentage = 0.01 // 1%
    
    if (userNegotiationCount >= 100) feePercentage = 0.005 // 0.5%
    else if (userNegotiationCount >= 50) feePercentage = 0.007 // 0.7%
    else if (userNegotiationCount >= 20) feePercentage = 0.008 // 0.8%
    else if (userNegotiationCount >= 10) feePercentage = 0.009 // 0.9%
    
    return amount * feePercentage
  }

  const submitPriceRange = async () => {
    if (!user || !negotiation) return

    const minPrice = parseFloat(priceRange.min)
    const maxPrice = parseFloat(priceRange.max)

    if (isNaN(minPrice) || isNaN(maxPrice) || minPrice <= 0 || maxPrice <= 0) {
      toast({
        title: 'Invalid price range',
        description: 'Please enter valid positive numbers',
        variant: 'destructive'
      })
      return
    }

    if (minPrice > maxPrice) {
      toast({
        title: 'Invalid price range',
        description: 'Minimum price cannot be greater than maximum price',
        variant: 'destructive'
      })
      return
    }

    try {
      setSubmittingRange(true)

      // Determine user's role in this negotiation
      const userRole = negotiation.initiatorId === user.id 
        ? negotiation.initiatorRole 
        : (negotiation.initiatorRole === 'buyer' ? 'seller' : 'buyer')

      // Submit price range
      await blink.db.priceRanges.create({
        id: `range_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        negotiationId: negotiation.id,
        userId: user.id,
        userRole,
        minPrice,
        maxPrice
      })

      // Reload data to check for deal matching
      await loadNegotiationData()

      // Check if both ranges are now submitted
      const updatedRanges = await blink.db.priceRanges.list({
        where: { negotiationId: negotiation.id }
      })

      if (updatedRanges.length === 2) {
        // Both ranges submitted, check for overlap
        const buyerRange = updatedRanges.find(r => r.userRole === 'buyer')
        const sellerRange = updatedRanges.find(r => r.userRole === 'seller')

        if (buyerRange && sellerRange) {
          // Get user's negotiation count for fee calculation
          const userNegotiations = await blink.db.negotiations.list({
            where: { initiatorId: user.id }
          })

          const platformFee = calculatePlatformFee(
            (buyerRange.maxPrice + sellerRange.minPrice) / 2,
            userNegotiations.length
          )

          // Check if deal is possible after fee
          const proposedPrice = (buyerRange.maxPrice + sellerRange.minPrice) / 2
          const finalPrice = proposedPrice - platformFee

          if (sellerRange.minPrice <= buyerRange.maxPrice && finalPrice >= sellerRange.minPrice) {
            // Create deal
            const validUntil = new Date()
            validUntil.setDate(validUntil.getDate() + 7) // 7 days validity

            const newDeal = await blink.db.deals.create({
              id: `deal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              negotiationId: negotiation.id,
              buyerId: buyerRange.userId,
              sellerId: sellerRange.userId,
              agreedPrice: proposedPrice,
              platformFee,
              finalPrice,
              validUntil: validUntil.toISOString(),
              status: 'active'
            })

            // Update negotiation status
            await blink.db.negotiations.update(negotiation.id, {
              status: 'completed'
            })

            setDeal(newDeal)
            
            toast({
              title: 'Deal found!',
              description: `A mutually beneficial price of $${finalPrice.toFixed(2)} has been agreed upon`,
            })
          } else {
            toast({
              title: 'No deal possible',
              description: 'The price ranges do not overlap enough to create a profitable deal for both parties',
              variant: 'destructive'
            })
          }
        }
      }

      toast({
        title: 'Price range submitted',
        description: 'Your price range has been recorded anonymously',
      })

      setPriceRange({ min: '', max: '' })

    } catch (error) {
      console.error('Error submitting price range:', error)
      toast({
        title: 'Error',
        description: 'Failed to submit price range',
        variant: 'destructive'
      })
    } finally {
      setSubmittingRange(false)
    }
  }

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please sign in to view this negotiation</CardDescription>
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading negotiation...</p>
        </div>
      </div>
    )
  }

  if (!negotiation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Negotiation Not Found</CardTitle>
            <CardDescription>The negotiation you are looking for does not exist</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/dashboard')} className="w-full">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const userRole = negotiation.initiatorId === user.id 
    ? negotiation.initiatorRole 
    : (negotiation.initiatorRole === 'buyer' ? 'seller' : 'buyer')

  const userHasSubmittedRange = priceRanges.some(r => r.userId === user.id)
  const bothRangesSubmitted = priceRanges.length === 2

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{negotiation.title}</h1>
              <p className="text-gray-600 mt-1">
                Created {formatDate(negotiation.createdAt)} • Expires {formatDate(negotiation.expiresAt)}
              </p>
            </div>
            {getStatusBadge(negotiation.status)}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Negotiation Details */}
            <Card>
              <CardHeader>
                <CardTitle>Negotiation Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {negotiation.description && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Description</Label>
                    <p className="text-gray-900 mt-1">{negotiation.description}</p>
                  </div>
                )}

                {negotiation.itemLink && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Item/Service Link</Label>
                    <a 
                      href={negotiation.itemLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center text-blue-600 hover:text-blue-800 mt-1"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      View Item
                    </a>
                  </div>
                )}

                {negotiation.attachmentUrl && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Attachment</Label>
                    <a 
                      href={negotiation.attachmentUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center text-blue-600 hover:text-blue-800 mt-1"
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      View Attachment
                    </a>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Your Role</Label>
                    <Badge variant={userRole === 'buyer' ? 'secondary' : 'outline'} className="mt-1">
                      {userRole === 'buyer' ? 'Buyer' : 'Seller'}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700">Counterpart</Label>
                    <p className="text-gray-900 mt-1">{negotiation.counterpartEmail}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Price Range Submission */}
            {!userHasSubmittedRange && negotiation.status === 'pending' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <DollarSign className="h-5 w-5 mr-2" />
                    Submit Your Price Range
                  </CardTitle>
                  <CardDescription>
                    Enter your acceptable {userRole === 'buyer' ? 'buying' : 'selling'} price range. 
                    This information will remain anonymous until both parties submit their ranges.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="minPrice">
                        {userRole === 'buyer' ? 'Minimum you\'d pay' : 'Minimum you\'d accept'}
                      </Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="minPrice"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={priceRange.min}
                          onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="maxPrice">
                        {userRole === 'buyer' ? 'Maximum you\'d pay' : 'Maximum you\'d accept'}
                      </Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="maxPrice"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={priceRange.max}
                          onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
                          className="pl-10"
                        />
                      </div>
                    </div>
                  </div>
                  <Button 
                    onClick={submitPriceRange}
                    disabled={submittingRange || !priceRange.min || !priceRange.max}
                    className="w-full"
                  >
                    {submittingRange ? 'Submitting...' : 'Submit Price Range'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Deal Results */}
            {deal && (
              <Card className="border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="flex items-center text-green-800">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Deal Found!
                  </CardTitle>
                  <CardDescription className="text-green-700">
                    A mutually beneficial price has been agreed upon
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <Label className="text-sm font-medium text-green-700">Agreed Price</Label>
                      <p className="text-2xl font-bold text-green-800">{formatCurrency(deal.agreedPrice)}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-green-700">Platform Fee</Label>
                      <p className="text-lg font-semibold text-green-800">-{formatCurrency(deal.platformFee)}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-green-700">Final Price</Label>
                      <p className="text-2xl font-bold text-green-800">{formatCurrency(deal.finalPrice)}</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <div>
                      <Label className="text-sm font-medium text-green-700">Valid Until</Label>
                      <p className="text-green-800">{formatDate(deal.validUntil)}</p>
                    </div>
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      {deal.status === 'active' ? 'Active Deal' : deal.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Overall Status</span>
                  {getStatusBadge(negotiation.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Your Range</span>
                  {userHasSubmittedRange ? (
                    <Badge variant="outline" className="text-green-600 border-green-600">Submitted</Badge>
                  ) : (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Counterpart Range</span>
                  {priceRanges.some(r => r.userId !== user.id) ? (
                    <Badge variant="outline" className="text-green-600 border-green-600">Submitted</Badge>
                  ) : (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Progress */}
            <Card>
              <CardHeader>
                <CardTitle>Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                    <span className="text-sm">Negotiation created</span>
                  </div>
                  <div className="flex items-center">
                    {userHasSubmittedRange ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-600 mr-2" />
                    )}
                    <span className="text-sm">Your price range submitted</span>
                  </div>
                  <div className="flex items-center">
                    {priceRanges.some(r => r.userId !== user.id) ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-yellow-600 mr-2" />
                    )}
                    <span className="text-sm">Counterpart range submitted</span>
                  </div>
                  <div className="flex items-center">
                    {deal ? (
                      <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                    ) : bothRangesSubmitted ? (
                      <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-gray-400 mr-2" />
                    )}
                    <span className="text-sm">
                      {deal ? 'Deal created' : bothRangesSubmitted ? 'No deal possible' : 'Awaiting deal calculation'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Fee Calculator */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center text-blue-900">
                  <Calculator className="h-5 w-5 mr-2" />
                  Fee Calculator
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-800 space-y-2">
                <p>Platform fees are volume-based:</p>
                <ul className="space-y-1 text-xs">
                  <li>• 1-9 negotiations: 1.0%</li>
                  <li>• 10-19 negotiations: 0.9%</li>
                  <li>• 20-49 negotiations: 0.8%</li>
                  <li>• 50-99 negotiations: 0.7%</li>
                  <li>• 100+ negotiations: 0.5%</li>
                </ul>
                <p className="text-xs text-blue-600 mt-2">
                  Fees are deducted from the agreed price to ensure deals remain profitable for both parties.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}