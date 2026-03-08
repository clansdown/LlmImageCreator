/**
 * Rating management helper functions
 * Reusable functions for image rating across the application
 */

import type { ConversationEntry } from './types/state';

/**
 * Gets rating for a specific image in an entry
 * @param {ConversationEntry} entry - Conversation entry
 * @param {number} imageIndex - Index of the image
 * @returns {number | null} Rating (1-5) or null if unrated
 */
export function getRatingForImage(entry: ConversationEntry, imageIndex: number): number | null {
    if (!entry.response.imageMetadata) {
        return null;
    }
    const metadata = entry.response.imageMetadata[imageIndex];
    return metadata?.rating ?? null;
}

/**
 * Sets rating for a specific image in an entry
 * @param {ConversationEntry} entry - Conversation entry
 * @param {number} imageIndex - Index of the image
 * @param {number | null} rating - Rating (1-5) or null to clear
 * @returns {boolean} True if rating was set successfully
 */
export function setRating(entry: ConversationEntry, imageIndex: number, rating: number | null): boolean {
    if (!entry.response.imageMetadata) {
        entry.response.imageMetadata = [];
    }

    while (entry.response.imageMetadata.length <= imageIndex) {
        entry.response.imageMetadata.push({ tags: [] });
    }

    const metadata = entry.response.imageMetadata[imageIndex];
    if (!metadata) {
        return false;
    }

    if (rating === null) {
        metadata.rating = null;
    } else if (rating >= 1 && rating <= 5) {
        metadata.rating = rating;
    } else {
        return false;
    }

    return true;
}

/**
 * Converts a rating number to a star display string
number | null} * @param { rating - Rating (1-5) or null
 * @returns {string} Star string like "★★★☆☆" or "☆☆☆☆☆" for null
 */
export function ratingToStars(rating: number | null): string {
    if (rating === null) {
        return "☆☆☆☆☆";
    }

    let stars = "";
    for (let i = 1; i <= 5; i++) {
        stars += i <= rating ? "★" : "☆";
    }
    return stars;
}

/**
 * Checks if a rating matches a filter criteria
 * @param {number | null} rating - Rating to check
 * @param {number | null} filter - Filter value (null=all, 0=unrated, 1-5=minimum rating)
 * @returns {boolean} True if rating passes the filter
 */
export function ratingMatchesFilter(rating: number | null, filter: number | null): boolean {
    if (filter === null || filter === undefined) {
        return true;
    }

    if (filter === 0) {
        return rating === null;
    }

    return rating !== null && rating >= filter;
}
