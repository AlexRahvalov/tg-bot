import { executeQuery } from '../db/connection';
import type { UserProfile, RatingDetail } from '../models/types';
import { logger } from '../utils/logger';

interface RatingRow {
    id: number;
    target_user_id: number;
    rater_id: number;
    value: number;
    reason: string | null;
    created_at: string;
    rater_nickname: string;
}

export class ProfileService {
    async createProfile(telegramId: number, nickname: string, minecraftNickname?: string): Promise<void> {
        try {
            await executeQuery(
                `INSERT INTO users (telegram_id, nickname, minecraft_nickname) 
                 VALUES (?, ?, ?)`,
                [telegramId, nickname, minecraftNickname]
            );
        } catch (error) {
            logger.error('Error creating user profile:', error);
            throw new Error('Failed to create user profile');
        }
    }

    async getProfile(telegramId: number): Promise<UserProfile | null> {
        try {
            const rows = await executeQuery(
                `SELECT 
                    id as user_id,
                    nickname,
                    minecraft_nickname as minecraft_username,
                    join_date,
                    total_ratings_given,
                    COALESCE(total_ratings_received, 0) as total_ratings_received,
                    COALESCE(positive_ratings_received, 0) as positive_ratings_received,
                    COALESCE(negative_ratings_received, 0) as negative_ratings_received,
                    last_rating_given
                 FROM users
                 WHERE telegram_id = ?`,
                [telegramId]
            );

            if (!Array.isArray(rows) || rows.length === 0) {
                return null;
            }

            const user = rows[0];
            logger.info(`Получены данные профиля: id=${user.user_id}, nickname=${user.nickname}, minecraft=${user.minecraft_username}`);

            return {
                user_id: user.user_id,
                nickname: user.nickname,
                minecraft_username: user.minecraft_username,
                join_date: user.join_date ? new Date(user.join_date) : new Date(),
                total_ratings_given: user.total_ratings_given || 0,
                total_ratings_received: user.total_ratings_received || 0,
                positive_ratings_received: user.positive_ratings_received || 0,
                negative_ratings_received: user.negative_ratings_received || 0,
                last_rating_given: user.last_rating_given ? new Date(user.last_rating_given) : undefined
            };
        } catch (error) {
            logger.error('Error getting user profile:', error);
            throw new Error('Failed to get user profile');
        }
    }

    async updateProfile(userId: number, updates: Partial<UserProfile>): Promise<void> {
        try {
            const allowedFields = ['nickname', 'minecraft_nickname'];
            const validUpdates = Object.entries(updates)
                .filter(([key]) => allowedFields.includes(key))
                .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

            if (Object.keys(validUpdates).length === 0) {
                return;
            }

            const setClause = Object.keys(validUpdates)
                .map(key => `${key} = ?`)
                .join(', ');
            const values = [...Object.values(validUpdates), userId];

            await executeQuery(
                `UPDATE users SET ${setClause} WHERE id = ?`,
                values
            );
        } catch (error) {
            logger.error('Error updating user profile:', error);
            throw new Error('Failed to update user profile');
        }
    }

    async getRatingHistory(userId: number): Promise<RatingDetail[]> {
        try {
            const rows = await executeQuery(
                `SELECT r.*, u.nickname as rater_nickname
                 FROM ratings r
                 JOIN users u ON u.id = r.rater_id
                 WHERE r.target_user_id = ?
                 ORDER BY r.created_at DESC
                 LIMIT 50`,
                [userId]
            );

            return rows.map((row: RatingRow) => ({
                id: row.id,
                targetUserId: row.target_user_id,
                raterId: row.rater_id,
                isPositive: row.value > 0,
                raterNickname: row.rater_nickname,
                reason: row.reason,
                createdAt: new Date(row.created_at)
            }));
        } catch (error) {
            logger.error('Error getting rating history:', error);
            throw new Error('Failed to get rating history');
        }
    }

    async updateRatingStats(userId: number, isPositive: boolean, isReceived: boolean = true): Promise<void> {
        try {
            if (isReceived) {
                const field = isPositive ? 'positive_ratings_received' : 'negative_ratings_received';
                await executeQuery(
                    `UPDATE users 
                     SET ${field} = ${field} + 1,
                         total_ratings_received = total_ratings_received + 1
                     WHERE id = ?`,
                    [userId]
                );
            } else {
                await executeQuery(
                    `UPDATE users 
                     SET total_ratings_given = total_ratings_given + 1,
                         last_rating_given = CURRENT_TIMESTAMP
                     WHERE id = ?`,
                    [userId]
                );
            }
        } catch (error) {
            logger.error('Error updating rating stats:', error);
            throw new Error('Failed to update rating stats');
        }
    }

    async getProfileByNickname(nickname: string): Promise<UserProfile[]> {
        try {
            const rows = await executeQuery(
                `SELECT 
                    id as user_id,
                    nickname,
                    minecraft_nickname as minecraft_username,
                    join_date,
                    total_ratings_given,
                    total_ratings_received,
                    positive_ratings_received,
                    negative_ratings_received,
                    last_rating_given
                 FROM users
                 WHERE nickname LIKE ?
                 LIMIT 5`,
                [`%${nickname}%`]
            );

            return rows as UserProfile[];
        } catch (error) {
            logger.error('Error getting profiles by nickname:', error);
            throw new Error('Failed to get profiles by nickname');
        }
    }
} 