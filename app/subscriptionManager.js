import { openDatabaseSync } from "expo-sqlite";

const db = openDatabaseSync("appdata.db");

// Subscription types
export const SUBSCRIPTION_TYPES = {
  FREE: "free",
  MONTHLY: "monthly",
  YEARLY: "yearly",
};

// Subscription status
export const SUBSCRIPTION_STATUS = {
  ACTIVE: "active",
  TRIAL: "trial",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
};

// Premium rank system (only for premium users)
export const PREMIUM_RANKS = [
  { minPerfect: 25, name: "Grand Master", color: "#a855f7", emoji: "🎓👑" },
  { minPerfect: 40, name: "Legend", color: "#ec4899", emoji: "⭐🏆" },
  { minPerfect: 60, name: "Deity", color: "#f97316", emoji: "🌟✨" },
];

// Feature flags
export const FEATURES = {
  UNLIMITED_QUIZZES: "unlimited_quizzes",
  AD_FREE: "ad_free",
  ADVANCED_STATS: "advanced_stats",
  PREMIUM_RANKS: "premium_ranks",
  PROGRESS_ANALYTICS: "progress_analytics",
  PREMIUM_THEMES: "premium_themes",
};

// Daily quiz limit for free users
export const FREE_DAILY_QUIZ_LIMIT = 5;

/**
 * Initialize subscription tables in database
 */
export const initializeSubscriptionTables = async () => {
  try {
    // Create subscription table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_subscription (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT DEFAULT 'default',
        subscriptionType TEXT DEFAULT 'free',
        subscriptionStatus TEXT DEFAULT 'active',
        startDate TEXT,
        endDate TEXT,
        trialStartDate TEXT,
        trialEndDate TEXT,
        purchaseToken TEXT,
        dailyQuizCount INTEGER DEFAULT 0,
        lastQuizDate TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create subscription features table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS subscription_features (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        featureId TEXT UNIQUE NOT NULL,
        featureName TEXT NOT NULL,
        isPremium INTEGER DEFAULT 0,
        isEnabled INTEGER DEFAULT 1
      );
    `);

    // Check if default subscription exists
    const existingSub = await db.getFirstAsync(
      "SELECT * FROM user_subscription WHERE userId = 'default'",
    );

    if (!existingSub) {
      // Create default free subscription with 7-day trial
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      await db.runAsync(
        `INSERT INTO user_subscription (
          userId, subscriptionType, subscriptionStatus, 
          startDate, trialStartDate, trialEndDate, lastQuizDate
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          "default",
          SUBSCRIPTION_TYPES.FREE,
          SUBSCRIPTION_STATUS.TRIAL,
          now.toISOString(),
          now.toISOString(),
          trialEnd.toISOString(),
          now.toISOString().split("T")[0],
        ],
      );
    }

    // Insert feature flags if not exist
    const features = [
      {
        featureId: FEATURES.UNLIMITED_QUIZZES,
        featureName: "Unlimited Quizzes",
        isPremium: 1,
      },
      {
        featureId: FEATURES.AD_FREE,
        featureName: "Ad-Free Experience",
        isPremium: 1,
      },
      {
        featureId: FEATURES.ADVANCED_STATS,
        featureName: "Advanced Statistics",
        isPremium: 1,
      },
      {
        featureId: FEATURES.PREMIUM_RANKS,
        featureName: "Premium Ranks",
        isPremium: 1,
      },
      {
        featureId: FEATURES.PROGRESS_ANALYTICS,
        featureName: "Progress Analytics",
        isPremium: 1,
      },
      {
        featureId: FEATURES.PREMIUM_THEMES,
        featureName: "Premium Themes",
        isPremium: 1,
      },
    ];

    for (const feature of features) {
      await db.runAsync(
        `INSERT OR IGNORE INTO subscription_features (featureId, featureName, isPremium) 
         VALUES (?, ?, ?)`,
        [feature.featureId, feature.featureName, feature.isPremium],
      );
    }

    console.log("✅ Subscription tables initialized");
  } catch (error) {
    console.error("❌ Error initializing subscription tables:", error);
  }
};

/**
 * Get current subscription status
 */
export const getSubscriptionStatus = async () => {
  try {
    const subscription = await db.getFirstAsync(
      "SELECT * FROM user_subscription WHERE userId = 'default'",
    );

    if (!subscription) {
      return {
        type: SUBSCRIPTION_TYPES.FREE,
        status: SUBSCRIPTION_STATUS.EXPIRED,
        isPremium: false,
        isInTrial: false,
        daysLeftInTrial: 0,
      };
    }

    const now = new Date();
    const isInTrial =
      subscription.subscriptionStatus === SUBSCRIPTION_STATUS.TRIAL &&
      subscription.trialEndDate &&
      new Date(subscription.trialEndDate) > now;

    const isPremium =
      subscription.subscriptionType !== SUBSCRIPTION_TYPES.FREE &&
      (subscription.subscriptionStatus === SUBSCRIPTION_STATUS.ACTIVE ||
        isInTrial) &&
      (!subscription.endDate || new Date(subscription.endDate) > now);

    let daysLeftInTrial = 0;
    if (isInTrial && subscription.trialEndDate) {
      const trialEnd = new Date(subscription.trialEndDate);
      daysLeftInTrial = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
    }

    return {
      ...subscription,
      isPremium,
      isInTrial,
      daysLeftInTrial,
    };
  } catch (error) {
    console.error("❌ Error getting subscription status:", error);
    return {
      type: SUBSCRIPTION_TYPES.FREE,
      status: SUBSCRIPTION_STATUS.EXPIRED,
      isPremium: false,
      isInTrial: false,
      daysLeftInTrial: 0,
    };
  }
};

/**
 * Check if user can start a new quiz (respects daily limit for free users)
 */
export const canStartQuiz = async () => {
  try {
    const subscription = await getSubscriptionStatus();

    // Premium users have unlimited access
    if (subscription.isPremium || subscription.isInTrial) {
      return {
        canStart: true,
        quizzesLeft: -1, // unlimited
        isPremium: true,
      };
    }

    // Check daily limit for free users
    const today = new Date().toISOString().split("T")[0];
    const sub = await db.getFirstAsync(
      "SELECT * FROM user_subscription WHERE userId = 'default'",
    );

    let dailyCount = sub.dailyQuizCount || 0;
    const lastQuizDate = sub.lastQuizDate;

    // Reset count if it's a new day
    if (lastQuizDate !== today) {
      dailyCount = 0;
    }

    const quizzesLeft = FREE_DAILY_QUIZ_LIMIT - dailyCount;
    const canStart = dailyCount < FREE_DAILY_QUIZ_LIMIT;

    return {
      canStart,
      quizzesLeft: Math.max(0, quizzesLeft),
      isPremium: false,
      dailyLimit: FREE_DAILY_QUIZ_LIMIT,
    };
  } catch (error) {
    console.error("❌ Error checking quiz availability:", error);
    return {
      canStart: true,
      quizzesLeft: FREE_DAILY_QUIZ_LIMIT,
      isPremium: false,
    };
  }
};

/**
 * Increment quiz count (for free users)
 */
export const incrementQuizCount = async () => {
  try {
    const subscription = await getSubscriptionStatus();

    // Don't track for premium users
    if (subscription.isPremium || subscription.isInTrial) {
      return;
    }

    const today = new Date().toISOString().split("T")[0];
    const sub = await db.getFirstAsync(
      "SELECT * FROM user_subscription WHERE userId = 'default'",
    );

    let newCount = 1;
    if (sub.lastQuizDate === today) {
      newCount = (sub.dailyQuizCount || 0) + 1;
    }

    await db.runAsync(
      `UPDATE user_subscription 
       SET dailyQuizCount = ?, lastQuizDate = ?, updatedAt = ?
       WHERE userId = 'default'`,
      [newCount, today, new Date().toISOString()],
    );

    console.log(`✅ Quiz count updated: ${newCount}/${FREE_DAILY_QUIZ_LIMIT}`);
  } catch (error) {
    console.error("❌ Error incrementing quiz count:", error);
  }
};

/**
 * Check if user has access to a specific feature
 */
export const hasFeatureAccess = async (featureId) => {
  try {
    const subscription = await getSubscriptionStatus();

    // Check if it's a premium feature
    const feature = await db.getFirstAsync(
      "SELECT * FROM subscription_features WHERE featureId = ?",
      [featureId],
    );

    if (!feature) {
      return true; // If feature doesn't exist, grant access
    }

    // Premium features require premium subscription or trial
    if (feature.isPremium) {
      return subscription.isPremium || subscription.isInTrial;
    }

    return feature.isEnabled === 1;
  } catch (error) {
    console.error("❌ Error checking feature access:", error);
    return false;
  }
};

/**
 * Activate premium subscription (after successful purchase)
 */
export const activatePremiumSubscription = async (type, purchaseToken) => {
  try {
    const now = new Date();
    let endDate;

    if (type === SUBSCRIPTION_TYPES.MONTHLY) {
      endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    } else if (type === SUBSCRIPTION_TYPES.YEARLY) {
      endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    }

    await db.runAsync(
      `UPDATE user_subscription 
       SET subscriptionType = ?,
           subscriptionStatus = ?,
           startDate = ?,
           endDate = ?,
           purchaseToken = ?,
           updatedAt = ?
       WHERE userId = 'default'`,
      [
        type,
        SUBSCRIPTION_STATUS.ACTIVE,
        now.toISOString(),
        endDate.toISOString(),
        purchaseToken,
        now.toISOString(),
      ],
    );

    console.log(`✅ Premium subscription activated: ${type}`);
    return true;
  } catch (error) {
    console.error("❌ Error activating premium:", error);
    return false;
  }
};

/**
 * End trial period and revert to free
 */
export const endTrialPeriod = async () => {
  try {
    await db.runAsync(
      `UPDATE user_subscription 
       SET subscriptionStatus = ?,
           updatedAt = ?
       WHERE userId = 'default' AND subscriptionType = 'free'`,
      [SUBSCRIPTION_STATUS.ACTIVE, new Date().toISOString()],
    );

    console.log("✅ Trial period ended");
  } catch (error) {
    console.error("❌ Error ending trial:", error);
  }
};

/**
 * Get all available ranks (including premium if user has access)
 */
export const getAvailableRanks = async () => {
  const subscription = await getSubscriptionStatus();
  const baseRanks = [
    { minPerfect: 0, name: "Student", color: "#94a3b8", emoji: "📚" },
    { minPerfect: 1, name: "Scholar", color: "#60a5fa", emoji: "🎓" },
    { minPerfect: 3, name: "Bachelor", color: "#8b5cf6", emoji: "🎓⭐" },
    { minPerfect: 5, name: "Master", color: "#10b981", emoji: "🎓⭐⭐" },
    { minPerfect: 10, name: "Doctor", color: "#f59e0b", emoji: "🧪👨‍🔬" },
    { minPerfect: 20, name: "Professor", color: "#ef4444", emoji: "🦉👔" },
  ];

  if (subscription.isPremium || subscription.isInTrial) {
    return [...baseRanks, ...PREMIUM_RANKS];
  }

  return baseRanks;
};

/**
 * Check if trial has expired and update status
 */
export const checkAndUpdateTrialStatus = async () => {
  try {
    const subscription = await getSubscriptionStatus();

    if (subscription.isInTrial && subscription.daysLeftInTrial <= 0) {
      await endTrialPeriod();
      return false; // Trial expired
    }

    return subscription.isInTrial;
  } catch (error) {
    console.error("❌ Error checking trial status:", error);
    return false;
  }
};

export default {
  initializeSubscriptionTables,
  getSubscriptionStatus,
  canStartQuiz,
  incrementQuizCount,
  hasFeatureAccess,
  activatePremiumSubscription,
  endTrialPeriod,
  getAvailableRanks,
  checkAndUpdateTrialStatus,
  SUBSCRIPTION_TYPES,
  SUBSCRIPTION_STATUS,
  FEATURES,
  FREE_DAILY_QUIZ_LIMIT,
};
