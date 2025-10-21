import { describe, expect, test } from 'bun:test';
import { componentRegistry } from '@shipsec/component-sdk';
import '../notify';

describe('Notify component registration', () => {
  test('registers ProjectDiscovery notify component with expected defaults', () => {
    const component = componentRegistry.get('shipsec.notify.dispatch');
    expect(component).toBeDefined();
    expect(component?.category).toBe('notifications');
    expect(component?.metadata?.slug).toBe('notify');

    if (component?.runner?.kind === 'docker') {
      expect(component.runner.image).toContain('projectdiscovery/notify');
      expect(component.runner.entrypoint).toBe('sh');
    } else {
      throw new Error('Expected docker runner for notify component');
    }
  });
});
