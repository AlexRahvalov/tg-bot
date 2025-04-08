/**
 * Тесты для функций в middleware/utils.ts
 */

// Импортируем типы для тестов Bun
import { describe, expect, test } from 'bun:test';
import {
  isBasicCommand,
  isApplicationCallback,
  isAdminCommand,
  isAdminCallback,
  isMemberCommand,
  isMemberCallback,
  isAdmin,
  isMember
} from '../../middleware/utils';
import { UserRole } from '../../models/types';

describe('Middleware utils', () => {
  
  // Тесты для isBasicCommand
  describe('isBasicCommand', () => {
    test('должен вернуть true для базовых команд', () => {
      expect(isBasicCommand('/start')).toBe(true);
      expect(isBasicCommand('/help')).toBe(true);
      expect(isBasicCommand('/apply')).toBe(true);
      expect(isBasicCommand('/status')).toBe(true);
    });
    
    test('должен вернуть false для команд, не входящих в список базовых', () => {
      expect(isBasicCommand('/admin')).toBe(false);
      expect(isBasicCommand('/unknown')).toBe(false);
      expect(isBasicCommand('/members')).toBe(false);
    });
    
    test('должен вернуть false для undefined и пустой строки', () => {
      expect(isBasicCommand(undefined)).toBe(false);
      expect(isBasicCommand('')).toBe(false);
    });
  });
  
  // Тесты для isApplicationCallback
  describe('isApplicationCallback', () => {
    test('должен вернуть true для колбэков, связанных с заявками', () => {
      expect(isApplicationCallback('confirm_application_123')).toBe(true);
      expect(isApplicationCallback('cancel_application')).toBe(true);
      expect(isApplicationCallback('back_to_main')).toBe(true);
      expect(isApplicationCallback('show_application_456')).toBe(true);
      expect(isApplicationCallback('start_application')).toBe(true);
    });
    
    test('должен вернуть false для других колбэков', () => {
      expect(isApplicationCallback('admin_settings')).toBe(false);
      expect(isApplicationCallback('view_profile_123')).toBe(false);
      expect(isApplicationCallback('rate_positive_123')).toBe(false);
    });
    
    test('должен вернуть false для undefined и пустой строки', () => {
      expect(isApplicationCallback(undefined)).toBe(false);
      expect(isApplicationCallback('')).toBe(false);
    });
  });
  
  // Тесты для isAdmin
  describe('isAdmin', () => {
    test('должен вернуть true для пользователя с ролью ADMIN', () => {
      expect(isAdmin({ role: UserRole.ADMIN } as any)).toBe(true);
    });
    
    test('должен вернуть false для пользователя с другой ролью', () => {
      expect(isAdmin({ role: UserRole.MEMBER } as any)).toBe(false);
      expect(isAdmin({ role: UserRole.APPLICANT } as any)).toBe(false);
    });
    
    test('должен вернуть false для null и undefined', () => {
      expect(isAdmin(null)).toBe(false);
      expect(isAdmin(null)).toBe(false);
    });
  });
  
  // Тесты для isMember
  describe('isMember', () => {
    test('должен вернуть true для пользователя с ролью MEMBER или ADMIN', () => {
      expect(isMember({ role: UserRole.MEMBER } as any)).toBe(true);
      expect(isMember({ role: UserRole.ADMIN } as any)).toBe(true);
    });
    
    test('должен вернуть false для пользователя с другой ролью', () => {
      expect(isMember({ role: UserRole.APPLICANT } as any)).toBe(false);
    });
    
    test('должен вернуть false для null и undefined', () => {
      expect(isMember(null)).toBe(false);
      expect(isMember(null)).toBe(false);
    });
  });
  
}); 