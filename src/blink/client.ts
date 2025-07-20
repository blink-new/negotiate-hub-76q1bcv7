import { createClient } from '@blinkdotnew/sdk'

export const blink = createClient({
  projectId: 'negotiate-hub-76q1bcv7',
  authRequired: true
})

export default blink