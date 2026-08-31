import assert from 'node:assert/strict';
import test from 'node:test';
import { formatReminderMessage, validatePhoneNumber } from '../src/sms.js';

test('validates E.164 phone numbers', () => {
  assert.equal(validatePhoneNumber('+15551234567'), true);
  assert.equal(validatePhoneNumber('5551234567'), false);
  assert.equal(validatePhoneNumber('+01234567890'), false);
});

test('formats selected tasks into an SMS-friendly list', () => {
  assert.equal(
    formatReminderMessage([{ task: 'Buy milk' }, { task: 'Call dentist' }]),
    'Your to-do list:\n1. Buy milk\n2. Call dentist'
  );
});
