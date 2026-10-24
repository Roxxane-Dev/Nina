import { describeListenError } from './listen-error'

describe('describeListenError', () => {
  it('explains EADDRINUSE and how to restart', () => {
    const msg = describeListenError(Object.assign(new Error('x'), { code: 'EADDRINUSE' }), 3000)
    expect(msg).toContain('Port 3000 is already in use')
    expect(msg).toContain('stop-local.ps1')
  })

  it('explains EACCES', () => {
    expect(describeListenError({ code: 'EACCES' }, '80')).toContain('No permission')
  })

  it('returns null for errors it does not know', () => {
    expect(describeListenError(new Error('boom'), 3000)).toBeNull()
    expect(describeListenError(undefined, 3000)).toBeNull()
  })
})
