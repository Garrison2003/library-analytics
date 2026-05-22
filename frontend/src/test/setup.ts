import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

global.matchMedia = global.matchMedia || function () {
  return {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  };
};
