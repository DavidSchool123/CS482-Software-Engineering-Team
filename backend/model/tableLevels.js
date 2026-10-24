/**
 * Defines the betting rules and buy-in limits for each table level
 * (Low, Medium, and High).
 *
 * Each level specifies the fixed betting amounts, minimum and maximum
 * buy-ins, ante, and bring-in. Keeping these values in one place
 * ensures consistent rules across tables and makes them easier to update.
 */

const TABLE_LEVELS = {
    Low: {
        smallBet: 5,
        bigBet: 10,
        minBuyIn: 200,
        maxBuyIn: 1000,
        ante: 1,
        bringIn: 2,
    },

    Medium: {
        smallBet: 10,
        bigBet: 20,
        minBuyIn: 400,
        maxBuyIn: 2000,
        ante: 2,
        bringIn: 5,
    },

    High: {
        smallBet: 25,
        bigBet: 50,
        minBuyIn: 1000,
        maxBuyIn: 5000,
        ante: 5,
        bringIn: 10,
    },
};

module.exports = TABLE_LEVELS;
