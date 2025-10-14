import '@testing-library/jest-dom'
import globalJsdom from 'global-jsdom'

if (typeof document === 'undefined') {
  globalJsdom('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
}

if (typeof window !== 'undefined' && window.HTMLElement) {
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    value: function scrollIntoView() {
      /* noop for tests */
    },
    configurable: true,
  })
}

if (typeof globalThis.EventSource === 'undefined') {
  class MockEventSource {
    public url: string
    public readyState = 0
    public onopen: ((this: EventSource, ev: Event) => any) | null = null
    public onmessage: ((this: EventSource, ev: MessageEvent) => any) | null = null
    public.onerror: ((this: EventSource, ev: Event) => any) | null = null

    constructor(url: string) {
      this.url = url
      setTimeout(() => {
        this.readyState = 1
        this.onopen?.call(this as any, new Event('open'))
      }, 0)
    }

    addEventListener() {
      /* no-op */
    }

    removeEventListener() {
      /* no-op */
    }

    close() {
      this.readyState = 2
    }
  }

  // @ts-expect-error mock assignment for tests
  globalThis.EventSource = MockEventSource
}
