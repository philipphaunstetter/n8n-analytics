import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { resendApiKey, fromEmail, fromName, testEmail } = body

    if (!resendApiKey || !fromEmail || !testEmail) {
      return NextResponse.json(
        { error: 'API key, from email, and test email are required' },
        { status: 400 }
      )
    }

    // Validate Resend API key format
    if (!resendApiKey.startsWith('re_')) {
      return NextResponse.json(
        { error: 'Invalid Resend API key format. API key should start with "re_"' },
        { status: 400 }
      )
    }

    // Test email with Resend API
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
        to: [testEmail],
        subject: 'Elova Email Configuration Test',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">📊 Elova</h1>
              <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Workflow Observability Platform</p>
            </div>
            
            <div style="padding: 30px; background: white;">
              <h2 style="color: #333; margin: 0 0 20px 0;">Email Configuration Test</h2>
              
              <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0; color: #0c4a6e;">
                  <strong>✅ Success!</strong> Your email configuration is working correctly.
                </p>
              </div>
              
              <p style="color: #666; line-height: 1.6;">
                This test email confirms that Elova can successfully send notifications using your Resend configuration.
              </p>
              
              <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #333; margin: 0 0 15px 0; font-size: 16px;">Configuration Details:</h3>
                <ul style="margin: 0; padding-left: 20px; color: #666;">
                  <li><strong>From Email:</strong> ${fromEmail}</li>
                  <li><strong>From Name:</strong> ${fromName || 'Not specified'}</li>
                  <li><strong>Test Email:</strong> ${testEmail}</li>
                  <li><strong>API Key:</strong> ${resendApiKey.slice(0, 8)}...</li>
                </ul>
              </div>
              
              <p style="color: #666; line-height: 1.6;">
                You'll receive notifications for:
              </p>
              <ul style="color: #666; line-height: 1.6;">
                <li>Workflow execution failures</li>
                <li>Performance alerts and slowdowns</li>
                <li>System maintenance notifications</li>
                <li>Weekly summary reports</li>
              </ul>
              
              <div style="border-top: 1px solid #eee; margin: 30px 0 0 0; padding: 20px 0 0 0;">
                <p style="color: #999; font-size: 14px; margin: 0;">
                  This email was sent by Elova during the setup process. 
                  You can manage your notification preferences in the admin settings.
                </p>
              </div>
            </div>
          </div>
        `,
        text: `
Elova Email Configuration Test

✅ Success! Your email configuration is working correctly.

This test email confirms that Elova can successfully send notifications using your Resend configuration.

Configuration Details:
- From Email: ${fromEmail}
- From Name: ${fromName || 'Not specified'}
- Test Email: ${testEmail}
- API Key: ${resendApiKey.slice(0, 8)}...

You'll receive notifications for:
- Workflow execution failures
- Performance alerts and slowdowns
- System maintenance notifications
- Weekly summary reports

This email was sent by Elova during the setup process. You can manage your notification preferences in the admin settings.
        `
      })
    })

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json().catch(() => ({}))
      
      let errorMessage = 'Failed to send test email'
      
      switch (resendResponse.status) {
        case 401:
          errorMessage = 'Invalid Resend API key. Please check your API key.'
          break
        case 403:
          errorMessage = 'Resend API key doesn\'t have permission to send emails.'
          break
        case 422:
          errorMessage = errorData.message || 'Invalid email configuration. Please check your from email address.'
          break
        case 429:
          errorMessage = 'Rate limit exceeded. Please try again in a few minutes.'
          break
        default:
          errorMessage = `Resend API error (${resendResponse.status}): ${errorData.message || 'Unknown error'}`
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      )
    }

    const result = await resendResponse.json()
    
    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully',
      emailId: result.id,
      fromEmail,
      testEmail
    })

  } catch (error) {
    console.error('Email test failed:', error)
    
    let errorMessage = 'Network error: Unable to send test email'
    
    if (error instanceof Error) {
      if (error.message.includes('fetch')) {
        errorMessage = 'Unable to connect to Resend API. Please check your internet connection.'
      } else {
        errorMessage = `Email test error: ${error.message}`
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}