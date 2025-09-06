import { UserRole } from '../models/types';
import type { User } from '../models/types';

/**
 * Компонент для управления ролями пользователей
 * Содержит все константы, проверки и утилиты для работы с ролями
 */
export class RoleManager {
  /**
   * Константы ролей
   */
  static readonly ROLES = {
    VISITOR: UserRole.VISITOR,
    APPLICANT: UserRole.APPLICANT,
    MEMBER: UserRole.MEMBER,
    ADMIN: UserRole.ADMIN
  } as const;

  /**
   * Отображаемые названия ролей на русском языке
   */
  static readonly ROLE_DISPLAY_NAMES = {
    [UserRole.VISITOR]: 'Посетитель',
    [UserRole.APPLICANT]: 'Заявитель',
    [UserRole.MEMBER]: 'Участник', 
    [UserRole.ADMIN]: 'Администратор'
  } as const;

  /**
   * Описания ролей
   */
  static readonly ROLE_DESCRIPTIONS = {
    [UserRole.VISITOR]: 'Пользователь, начавший взаимодействие с ботом',
    [UserRole.APPLICANT]: 'Пользователь, подавший заявку на вступление',
    [UserRole.MEMBER]: 'Полноправный участник сообщества с правом голоса',
    [UserRole.ADMIN]: 'Администратор с полными правами управления'
  } as const;

  /**
   * Иерархия ролей (чем больше число, тем выше роль)
   */
  static readonly ROLE_HIERARCHY = {
    [UserRole.VISITOR]: 0,
    [UserRole.APPLICANT]: 1,
    [UserRole.MEMBER]: 2,
    [UserRole.ADMIN]: 3
  } as const;

  /**
   * Права доступа для каждой роли
   */
  static readonly ROLE_PERMISSIONS = {
    [UserRole.VISITOR]: {
      canApply: true,
      canViewOwnApplication: true,
      canAnswerQuestions: false,
      canVote: false,
      canViewActiveApplications: false,
      canRateUsers: false,
      canAccessAdminPanel: false,
      canManageUsers: false,
      canManageApplications: false,
      canManageServer: false
    },
    [UserRole.APPLICANT]: {
      canApply: true,
      canViewOwnApplication: true,
      canAnswerQuestions: true,
      canVote: false,
      canViewActiveApplications: false,
      canRateUsers: false,
      canAccessAdminPanel: false,
      canManageUsers: false,
      canManageApplications: false,
      canManageServer: false
    },
    [UserRole.MEMBER]: {
      canApply: false, // уже участник
      canViewOwnApplication: true,
      canAnswerQuestions: true,
      canVote: true,
      canViewActiveApplications: true,
      canRateUsers: true,
      canAccessAdminPanel: false,
      canManageUsers: false,
      canManageApplications: false,
      canManageServer: false
    },
    [UserRole.ADMIN]: {
      canApply: false, // уже администратор
      canViewOwnApplication: true,
      canAnswerQuestions: true,
      canVote: true,
      canViewActiveApplications: true,
      canRateUsers: true,
      canAccessAdminPanel: true,
      canManageUsers: true,
      canManageApplications: true,
      canManageServer: true
    }
  } as const;

  /**
   * Проверяет, является ли пользователь администратором
   */
  static isAdmin(user: User | null): boolean {
    return user?.role === UserRole.ADMIN;
  }

  /**
   * Проверяет, является ли пользователь участником
   */
  static isMember(user: User | null): boolean {
    return user?.role === UserRole.MEMBER;
  }

  /**
   * Проверяет, является ли пользователь заявителем
   */
  static isApplicant(user: User | null): boolean {
    return user?.role === UserRole.APPLICANT;
  }

  /**
   * Проверяет, является ли пользователь посетителем
   */
  static isVisitor(user: User | null): boolean {
    return user?.role === UserRole.VISITOR;
  }

  /**
   * Проверяет, является ли пользователь участником или администратором
   */
  static isMemberOrAdmin(user: User | null): boolean {
    return user?.role === UserRole.MEMBER || user?.role === UserRole.ADMIN;
  }

  /**
   * Проверяет, может ли пользователь голосовать
   */
  static canVote(user: User | null): boolean {
    return user?.canVote === true && this.isMemberOrAdmin(user);
  }

  /**
   * Проверяет, может ли пользователь подавать заявки
   */
  static canApply(user: User | null): boolean {
    if (!user) return true; // новый пользователь может подать заявку
    return this.getPermissions(user.role).canApply;
  }

  /**
   * Проверяет, может ли пользователь просматривать активные заявки
   */
  static canViewActiveApplications(user: User | null): boolean {
    if (!user) return false;
    return this.getPermissions(user.role).canViewActiveApplications;
  }

  /**
   * Проверяет, может ли пользователь оценивать других пользователей
   */
  static canRateUsers(user: User | null): boolean {
    if (!user) return false;
    return this.getPermissions(user.role).canRateUsers && user.canVote;
  }

  /**
   * Проверяет, может ли пользователь получить доступ к админ-панели
   */
  static canAccessAdminPanel(user: User | null): boolean {
    if (!user) return false;
    return this.getPermissions(user.role).canAccessAdminPanel;
  }

  /**
   * Проверяет, может ли пользователь управлять другими пользователями
   */
  static canManageUsers(user: User | null): boolean {
    if (!user) return false;
    return this.getPermissions(user.role).canManageUsers;
  }

  /**
   * Проверяет, может ли пользователь управлять заявками
   */
  static canManageApplications(user: User | null): boolean {
    if (!user) return false;
    return this.getPermissions(user.role).canManageApplications;
  }

  /**
   * Проверяет, может ли пользователь управлять сервером
   */
  static canManageServer(user: User | null): boolean {
    if (!user) return false;
    return this.getPermissions(user.role).canManageServer;
  }

  /**
   * Получает отображаемое название роли
   */
  static getRoleDisplayName(role: UserRole): string {
    return this.ROLE_DISPLAY_NAMES[role] || 'Неизвестная роль';
  }

  /**
   * Получает описание роли
   */
  static getRoleDescription(role: UserRole): string {
    return this.ROLE_DESCRIPTIONS[role] || 'Описание недоступно';
  }

  /**
   * Получает уровень иерархии роли
   */
  static getRoleHierarchy(role: UserRole): number {
    return this.ROLE_HIERARCHY[role] || 0;
  }

  /**
   * Сравнивает роли по иерархии
   */
  static compareRoles(role1: UserRole, role2: UserRole): number {
    return this.getRoleHierarchy(role1) - this.getRoleHierarchy(role2);
  }

  /**
   * Проверяет, выше ли первая роль второй по иерархии
   */
  static isRoleHigher(role1: UserRole, role2: UserRole): boolean {
    return this.getRoleHierarchy(role1) > this.getRoleHierarchy(role2);
  }

  /**
   * Получает права доступа для роли
   */
  static getPermissions(role: UserRole) {
    return this.ROLE_PERMISSIONS[role];
  }

  /**
   * Получает все доступные роли
   */
  static getAllRoles(): UserRole[] {
    return Object.values(UserRole);
  }

  /**
   * Получает роли, доступные для повышения из текущей роли
   */
  static getPromotableRoles(currentRole: UserRole): UserRole[] {
    const currentHierarchy = this.getRoleHierarchy(currentRole);
    return this.getAllRoles().filter(role => 
      this.getRoleHierarchy(role) > currentHierarchy
    );
  }

  /**
   * Получает роли, доступные для понижения из текущей роли
   */
  static getDemotableRoles(currentRole: UserRole): UserRole[] {
    const currentHierarchy = this.getRoleHierarchy(currentRole);
    return this.getAllRoles().filter(role => 
      this.getRoleHierarchy(role) < currentHierarchy
    );
  }

  /**
   * Проверяет, может ли пользователь изменить роль другого пользователя
   */
  static canChangeUserRole(adminUser: User | null, targetRole: UserRole): boolean {
    if (!adminUser || !this.isAdmin(adminUser)) return false;
    
    // Администратор может изменять роли ниже своей
    return this.getRoleHierarchy(adminUser.role) > this.getRoleHierarchy(targetRole);
  }

  /**
   * Валидирует роль
   */
  static isValidRole(role: string): role is UserRole {
    return Object.values(UserRole).includes(role as UserRole);
  }

  /**
   * Получает следующую роль по иерархии (для повышения)
   */
  static getNextRole(currentRole: UserRole): UserRole | null {
    const promotableRoles = this.getPromotableRoles(currentRole);
    if (promotableRoles.length === 0) return null;
    
    // Возвращаем роль с минимальной иерархией среди доступных для повышения
    return promotableRoles.reduce((min, role) => 
      this.getRoleHierarchy(role) < this.getRoleHierarchy(min) ? role : min
    );
  }

  /**
   * Получает предыдущую роль по иерархии (для понижения)
   */
  static getPreviousRole(currentRole: UserRole): UserRole | null {
    const demotableRoles = this.getDemotableRoles(currentRole);
    if (demotableRoles.length === 0) return null;
    
    // Возвращаем роль с максимальной иерархией среди доступных для понижения
    return demotableRoles.reduce((max, role) => 
      this.getRoleHierarchy(role) > this.getRoleHierarchy(max) ? role : max
    );
  }
}

/**
 * Экспортируем константы для удобства использования
 */
export const ROLES = RoleManager.ROLES;
export const ROLE_DISPLAY_NAMES = RoleManager.ROLE_DISPLAY_NAMES;
export const ROLE_DESCRIPTIONS = RoleManager.ROLE_DESCRIPTIONS;
export const ROLE_PERMISSIONS = RoleManager.ROLE_PERMISSIONS;