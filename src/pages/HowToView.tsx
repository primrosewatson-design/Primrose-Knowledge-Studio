import { useState } from 'react'

export default function HowToView() {
  const [activeSection, setActiveSection] = useState<'select' | 'pay' | 'view'>('select')

  const steps = {
    select: {
      title: 'Step 1: Select Your Videos',
      description: 'Browse our collection and find the perfect learning materials.',
      icon: '🎬',
      details: [
        {
          title: 'Browse the Gallery',
          description: 'Visit the "How to Choose" page to explore all available videos organized by category.'
        },
        {
          title: 'Use Search & Filters',
          description: 'Search by topic, use category filters (React, TypeScript, CSS, etc.), or browse by skill level (Beginner, Intermediate, Advanced).'
        },
        {
          title: 'Preview Videos',
          description: 'Click "Watch Now" on any video to see a preview with the full title, description, duration, and category tags.'
        },
        {
          title: 'Add to Cart',
          description: 'When you find videos you want, click "Add to Cart" to prepare them for purchase.'
        }
      ]
    },
    pay: {
      title: 'Step 2: Complete Payment',
      description: 'Securely purchase your selected videos with Stripe.',
      icon: '💳',
      details: [
        {
          title: 'Review Your Cart',
          description: 'Check the "Cart" page to see all selected videos, quantities, and the total price.'
        },
        {
          title: 'Enter Payment Details',
          description: 'Proceed to checkout and securely enter your credit/debit card information. Your payment is processed through Stripe, a secure payment provider.'
        },
        {
          title: 'Supported Payment Methods',
          description: 'We accept all major credit cards (Visa, Mastercard, American Express), debit cards, and digital wallets.'
        },
        {
          title: 'Instant Confirmation',
          description: 'After successful payment, you\'ll receive an order confirmation email with access details and a receipt.'
        }
      ]
    },
    view: {
      title: 'Step 3: View Your Content',
      description: 'Access and enjoy your purchased videos anytime.',
      icon: '▶️',
      details: [
        {
          title: 'Access Your Library',
          description: 'Log in to your account and visit "My Library" or "Purchased Videos" to see all content you own.'
        },
        {
          title: 'Stream Anytime',
          description: 'Click any video to watch it with our embedded player. You can view each video up to 5 times after purchase.'
        },
        {
          title: 'Player Features',
          description: 'Use standard video controls: play/pause, volume, full-screen mode, playback speed adjustment, and video quality selection.'
        },
        {
          title: 'Offline Download (Coming Soon)',
          description: 'Soon, you\'ll be able to download videos to watch offline on your devices.'
        },
        {
          title: 'Take Notes',
          description: 'Pause videos to take notes, create bookmarks for key moments, or download transcripts (available for select videos).'
        }
      ]
    }
  }

  const currentStep = steps[activeSection]

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      {/* Header */}
      <div className="mb-12">
        <h1 className="mb-4 text-4xl font-bold text-royal-700">How to View</h1>
        <p className="text-lg text-gray-600">
          A complete guide to selecting, purchasing, and enjoying our expert knowledge videos.
        </p>
      </div>

      {/* Step Selector */}
      <div className="mb-12 grid gap-4 sm:grid-cols-3">
        {(['select', 'pay', 'view'] as const).map((section) => {
          const stepData = steps[section]
          const isActive = activeSection === section
          return (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={`rounded-lg p-6 text-left transition-all ${
                isActive
                  ? 'bg-royal-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
              }`}
            >
              <div className="mb-2 text-3xl">{stepData.icon}</div>
              <h3 className="font-bold">{stepData.title.split(':')[1]?.trim() || stepData.title}</h3>
              <p className={`mt-2 text-sm ${isActive ? 'text-white/80' : 'text-gray-600'}`}>
                {stepData.description}
              </p>
            </button>
          )
        })}
      </div>

      {/* Active Step Content */}
      <div className="rounded-lg border-2 border-royal-200 bg-white p-8">
        <div className="mb-8 flex items-center gap-4">
          <div className="text-5xl">{currentStep.icon}</div>
          <div>
            <h2 className="text-3xl font-bold text-royal-700">{currentStep.title}</h2>
            <p className="mt-2 text-gray-600">{currentStep.description}</p>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-6">
          {currentStep.details.map((detail, index) => (
            <div key={index} className="border-l-4 border-royal-600 pl-6 py-2">
              <h4 className="font-bold text-gray-900">{detail.title}</h4>
              <p className="mt-2 text-gray-700">{detail.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="mt-16">
        <h3 className="mb-8 text-2xl font-bold text-gray-900">Frequently Asked Questions</h3>
        <div className="space-y-4">
          <div className="rounded-lg bg-gray-50 p-6">
            <h4 className="font-semibold text-gray-900">Can I watch videos on multiple devices?</h4>
            <p className="mt-2 text-gray-700">Yes! Once purchased, you can access your videos from any device by logging into your account—desktop, tablet, or smartphone.</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-6">
            <h4 className="font-semibold text-gray-900">How many times can I watch a video?</h4>
            <p className="mt-2 text-gray-700">You can watch each purchased video up to 5 times. This allows you to review the content while keeping costs low for everyone.</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-6">
            <h4 className="font-semibold text-gray-900">What if I have technical issues?</h4>
            <p className="mt-2 text-gray-700">Our support team is here to help! Contact us at support@primroseknowledgestudio.com for any playback issues or account questions.</p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-16 rounded-lg bg-gradient-to-r from-royal-600 to-royal-700 p-8 text-center text-white">
        <h3 className="mb-4 text-2xl font-bold">Ready to Start Learning?</h3>
        <p className="mb-6 text-lg">Explore our video library and find the perfect courses for your learning goals.</p>
        <a
          href="/how-to-choose"
          className="inline-block rounded-lg bg-white px-8 py-3 font-semibold text-royal-700 transition-transform hover:scale-105"
        >
          Browse Videos Now
        </a>
      </div>
    </div>
  )
}
