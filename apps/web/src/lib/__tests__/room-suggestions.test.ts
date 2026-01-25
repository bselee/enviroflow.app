/**
 * Tests for room suggestion logic
 */

import { describe, it, expect } from '@jest/globals';
import { suggestRoomName, generateDefaultControllerName } from '../room-suggestions';
import type { ControllerCapabilities, ControllerBrand } from '@/types';

describe('suggestRoomName', () => {
  it('suggests "Grow Room" for controllers with temp + humidity + VPD', () => {
    const capabilities: ControllerCapabilities = {
      sensors: ['temperature', 'humidity', 'vpd'],
      devices: ['fan'],
    };

    const result = suggestRoomName(capabilities);

    expect(result.name).toBe('Grow Room');
    expect(result.confidence).toBe('high');
  });

  it('suggests "Grow Room" for controllers with light sensors', () => {
    const capabilities: ControllerCapabilities = {
      sensors: ['light', 'temperature'],
      devices: [],
    };

    const result = suggestRoomName(capabilities);

    expect(result.name).toBe('Grow Room');
    expect(result.confidence).toBe('high');
  });

  it('suggests "Climate Zone" for temp + humidity without VPD', () => {
    const capabilities: ControllerCapabilities = {
      sensors: ['temperature', 'humidity'],
      devices: [],
    };

    const result = suggestRoomName(capabilities);

    expect(result.name).toBe('Climate Zone');
    expect(result.confidence).toBe('medium');
  });

  it('suggests "Environment" for temperature-only controllers', () => {
    const capabilities: ControllerCapabilities = {
      sensors: ['temperature'],
      devices: [],
    };

    const result = suggestRoomName(capabilities);

    expect(result.name).toBe('Environment');
    expect(result.confidence).toBe('low');
  });

  it('suggests "Data Room" for CSV upload', () => {
    const capabilities: ControllerCapabilities = {
      sensors: ['temperature', 'humidity'],
      devices: [],
    };

    const result = suggestRoomName(capabilities, 'csv_upload');

    expect(result.name).toBe('Data Room');
    expect(result.confidence).toBe('medium');
  });

  it('suggests "Outdoor Station" for Ecowitt', () => {
    const capabilities: ControllerCapabilities = {
      sensors: ['temperature', 'humidity', 'pressure', 'wind_speed'],
      devices: [],
    };

    const result = suggestRoomName(capabilities, 'ecowitt');

    expect(result.name).toBe('Outdoor Station');
    expect(result.confidence).toBe('high');
  });

  it('suggests "Grow Room" for controllers with grow-related devices', () => {
    const capabilities: ControllerCapabilities = {
      sensors: [],
      devices: ['light', 'fan', 'humidifier'],
    };

    const result = suggestRoomName(capabilities);

    expect(result.name).toBe('Grow Room');
    expect(result.confidence).toBe('medium');
  });

  it('defaults to "Environment" for unknown configurations', () => {
    const capabilities: ControllerCapabilities = {
      sensors: [],
      devices: [],
    };

    const result = suggestRoomName(capabilities);

    expect(result.name).toBe('Environment');
    expect(result.confidence).toBe('low');
  });
});

describe('generateDefaultControllerName', () => {
  it('combines brand and model', () => {
    const result = generateDefaultControllerName('AC Infinity', 'Controller 69');

    expect(result).toBe('AC Infinity Controller 69');
  });

  it('handles missing model gracefully', () => {
    const result = generateDefaultControllerName('Inkbird');

    expect(result).toBe('Inkbird Controller');
  });

  it('handles null model', () => {
    const result = generateDefaultControllerName('AC Infinity', null);

    expect(result).toBe('AC Infinity Controller');
  });

  it('handles empty model', () => {
    const result = generateDefaultControllerName('AC Infinity', '   ');

    expect(result).toBe('AC Infinity Controller');
  });

  it('does not duplicate brand name if already in model', () => {
    const result = generateDefaultControllerName('AC Infinity', 'AC Infinity Controller 69');

    expect(result).toBe('AC Infinity Controller 69');
  });

  it('handles case-insensitive brand name in model', () => {
    const result = generateDefaultControllerName('AC Infinity', 'ac infinity controller 69');

    expect(result).toBe('ac infinity controller 69');
  });
});
