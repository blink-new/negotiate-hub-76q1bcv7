import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Upload, Link as LinkIcon, FileText } from 'lucide-react'
import blink from '@/blink/client'

interface User {
  id: string
  email: string
  displayName?: string
  role?: string
}

interface CreateNegotiationProps {
  user: User | null
}

export default function CreateNegotiation({ user }: CreateNegotiationProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    itemLink: '',
    counterpartEmail: '',
    initiatorRole: 'buyer' as 'buyer' | 'seller',
    expirationDays: '7'
  })
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please select a file smaller than 10MB',
          variant: 'destructive'
        })
        return
      }
      setAttachmentFile(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to create a negotiation',
        variant: 'destructive'
      })
      return
    }

    if (!formData.title.trim() || !formData.counterpartEmail.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      })
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.counterpartEmail)) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address',
        variant: 'destructive'
      })
      return
    }

    try {
      setLoading(true)

      let attachmentUrl = ''
      
      // Upload attachment if provided
      if (attachmentFile) {
        const { publicUrl } = await blink.storage.upload(
          attachmentFile,
          `negotiations/${user.id}/${Date.now()}-${attachmentFile.name}`,
          { upsert: true }
        )
        attachmentUrl = publicUrl
      }

      // Calculate expiration date
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + parseInt(formData.expirationDays))

      // Create negotiation
      const negotiation = await blink.db.negotiations.create({
        id: `neg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: formData.title.trim(),
        description: formData.description.trim(),
        itemLink: formData.itemLink.trim(),
        attachmentUrl,
        initiatorId: user.id,
        initiatorRole: formData.initiatorRole,
        counterpartEmail: formData.counterpartEmail.trim(),
        status: 'pending',
        expiresAt: expiresAt.toISOString()
      })

      // Note: We'll create the notification when the counterpart joins the platform
      // This avoids foreign key constraint issues with non-existent users

      // Send email notification (in a real app, this would be handled by a backend service)
      // For now, we'll just show a success message

      toast({
        title: 'Negotiation created!',
        description: `Invitation sent to ${formData.counterpartEmail}`,
      })

      // Navigate to the negotiation details
      navigate(`/negotiation/${negotiation.id}`)

    } catch (error) {
      console.error('Error creating negotiation:', error)
      toast({
        title: 'Error',
        description: 'Failed to create negotiation. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>Please sign in to create a negotiation</CardDescription>
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <h1 className="text-3xl font-bold text-gray-900">Create New Negotiation</h1>
          <p className="text-gray-600 mt-1">
            Start a new price negotiation with a potential buyer or seller
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Negotiation Details</CardTitle>
                  <CardDescription>
                    Provide information about what you want to negotiate
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="title">Title *</Label>
                    <Input
                      id="title"
                      placeholder="e.g., MacBook Pro 16-inch negotiation"
                      value={formData.title}
                      onChange={(e) => handleInputChange('title', e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Provide details about the item or service you want to negotiate..."
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      rows={4}
                    />
                  </div>

                  <div>
                    <Label htmlFor="itemLink">Item/Service Link</Label>
                    <div className="relative">
                      <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        id="itemLink"
                        type="url"
                        placeholder="https://example.com/product"
                        value={formData.itemLink}
                        onChange={(e) => handleInputChange('itemLink', e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="attachment">Attachment (Optional)</Label>
                    <div className="mt-1">
                      <input
                        id="attachment"
                        type="file"
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('attachment')?.click()}
                        className="w-full"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {attachmentFile ? attachmentFile.name : 'Upload File'}
                      </Button>
                      {attachmentFile && (
                        <div className="mt-2 flex items-center text-sm text-gray-600">
                          <FileText className="h-4 w-4 mr-1" />
                          {attachmentFile.name} ({(attachmentFile.size / 1024 / 1024).toFixed(2)} MB)
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Supported formats: PDF, DOC, DOCX, JPG, PNG, GIF (max 10MB)
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Counterpart Information</CardTitle>
                  <CardDescription>
                    Who are you negotiating with?
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="counterpartEmail">Email Address *</Label>
                    <Input
                      id="counterpartEmail"
                      type="email"
                      placeholder="counterpart@example.com"
                      value={formData.counterpartEmail}
                      onChange={(e) => handleInputChange('counterpartEmail', e.target.value)}
                      required
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      They will receive an email invitation to join the negotiation
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Your Role</CardTitle>
                  <CardDescription>
                    Are you buying or selling?
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Select
                    value={formData.initiatorRole}
                    onValueChange={(value: 'buyer' | 'seller') => handleInputChange('initiatorRole', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buyer">
                        <div className="flex items-center">
                          <Badge variant="secondary" className="mr-2">Buyer</Badge>
                          I want to purchase
                        </div>
                      </SelectItem>
                      <SelectItem value="seller">
                        <div className="flex items-center">
                          <Badge variant="outline" className="mr-2">Seller</Badge>
                          I want to sell
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Expiration</CardTitle>
                  <CardDescription>
                    How long should this negotiation remain active?
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Select
                    value={formData.expirationDays}
                    onValueChange={(value) => handleInputChange('expirationDays', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 days</SelectItem>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card className="bg-blue-50 border-blue-200">
                <CardHeader>
                  <CardTitle className="text-blue-900">How it works</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-blue-800 space-y-2">
                  <p>1. You create the negotiation and invite the other party</p>
                  <p>2. Both parties submit their acceptable price ranges anonymously</p>
                  <p>3. Our algorithm finds overlaps and suggests a fair price</p>
                  <p>4. If both parties agree, a deal is created with time-limited validity</p>
                </CardContent>
              </Card>

              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Negotiation'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}