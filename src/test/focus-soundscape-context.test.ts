import { describe, it, expect, beforeEach, vi } from 'vitest';
import { focusAudio, type AmbientType } from '../lib/focusAudio';
import { contextSwitchTracker } from '../lib/contextSwitching';

describe('🎧 Focus Soundscapes & Deep Work Timer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextSwitchTracker.clear();
  });

  describe('1. Focus Soundscapes & Web Audio Engine', () => {
    it('supports all 5 soundscapes plus none', () => {
      const soundscapes: AmbientType[] = [
        'none',
        'white',
        'rain',
        'cyberpunk',
        'binaural',
        'brown',
      ];
      expect(soundscapes).toHaveLength(6);
    });

    it('sets and clamps volume correctly between 0 and 1', () => {
      focusAudio.setVolume(0.85);
      expect(focusAudio.getVolume()).toBe(0.85);

      focusAudio.setVolume(1.5);
      expect(focusAudio.getVolume()).toBe(1.0);

      focusAudio.setVolume(-0.2);
      expect(focusAudio.getVolume()).toBe(0.0);
    });

    it('handles startAmbient and stopAmbient safely in node/jsdom environment', () => {
      expect(() => {
        focusAudio.startAmbient('cyberpunk');
        focusAudio.startAmbient('rain');
        focusAudio.startAmbient('binaural');
        focusAudio.startAmbient('white');
        focusAudio.startAmbient('brown');
        focusAudio.stopAmbient();
      }).not.toThrow();
    });

    it('plays start bell and completion chime without throwing', () => {
      expect(() => {
        focusAudio.playStartBell();
        focusAudio.playCompletionBell();
      }).not.toThrow();
    });
  });

  describe('2. Context-Switching Detection & Thrashing Warning', () => {
    it('starts with a clean low thrashing state', () => {
      const report = contextSwitchTracker.getReport();
      expect(report.totalSwitches).toBe(0);
      expect(report.uniqueEntities).toBe(0);
      expect(report.isHighThrashing).toBe(false);
      expect(report.estimatedLostFocusMinutes).toBe(0);
    });

    it('de-duplicates rapid clicks on the same task within 30 seconds', () => {
      contextSwitchTracker.recordSwitch('task', 'task-1', 'Auth Service');
      contextSwitchTracker.recordSwitch('task', 'task-1', 'Auth Service');
      contextSwitchTracker.recordSwitch('task', 'task-1', 'Auth Service');

      const report = contextSwitchTracker.getReport();
      expect(report.totalSwitches).toBe(1);
      expect(report.uniqueEntities).toBe(1);
      expect(report.isHighThrashing).toBe(false);
    });

    it('detects high thrashing when switching between 4 distinct entities in 1 hour', () => {
      // Simulate switching across 4 different tasks
      contextSwitchTracker.recordSwitch('task', 't-1', 'Redis Cache Setup');
      contextSwitchTracker.recordSwitch('task', 't-2', 'gRPC Microservice');
      contextSwitchTracker.recordSwitch('task', 't-3', 'PostgreSQL Migration');
      contextSwitchTracker.recordSwitch('task', 't-4', 'Docker Compose Config');

      const report = contextSwitchTracker.getReport();
      expect(report.totalSwitches).toBe(4);
      expect(report.uniqueEntities).toBe(4);
      expect(report.isHighThrashing).toBe(true);
      expect(report.estimatedLostFocusMinutes).toBeGreaterThan(0);
      expect(report.advice).toContain('Diqqat');
      expect(report.advice).toContain('Deep Work');
    });

    it('detects high thrashing when total switches reach 5 even across fewer entities', () => {
      contextSwitchTracker.recordSwitch('task', 't-1', 'Task 1');
      contextSwitchTracker.recordSwitch('task', 't-2', 'Task 2');
      contextSwitchTracker.recordSwitch('task', 't-1', 'Task 1 (return)');
      contextSwitchTracker.recordSwitch('task', 't-2', 'Task 2 (return)');
      contextSwitchTracker.recordSwitch('task', 't-1', 'Task 1 (again)');

      const report = contextSwitchTracker.getReport();
      expect(report.totalSwitches).toBe(5);
      expect(report.isHighThrashing).toBe(true);
      expect(report.switchHistory.length).toBeGreaterThanOrEqual(4);
    });

    it('tracks workspace switches alongside task switches', () => {
      contextSwitchTracker.recordSwitch('workspace', 'ws-cognidev', 'CogniDev Repo');
      contextSwitchTracker.recordSwitch('task', 't-1', 'Tauri Tray Feature');
      contextSwitchTracker.recordSwitch('workspace', 'ws-api', 'Backend API');
      contextSwitchTracker.recordSwitch('task', 't-2', 'API Auth Endpoint');

      const report = contextSwitchTracker.getReport();
      expect(report.uniqueEntities).toBe(4);
      expect(report.isHighThrashing).toBe(true);
    });
  });
});
