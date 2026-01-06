package license

import (
	"sync"
	"time"
)

// LicenseCacheEntry represents a cached license entry with TTL
type LicenseCacheEntry struct {
	LicensedModules []string
	CachedAt        time.Time
	TTL             time.Duration
}

// IsExpired checks if the cache entry has expired
func (e *LicenseCacheEntry) IsExpired() bool {
	return time.Since(e.CachedAt) > e.TTL
}

// LicenseCache provides thread-safe caching for license information
type LicenseCache struct {
	cache map[string]*LicenseCacheEntry
	mu    sync.RWMutex
	ttl   time.Duration
}

// NewLicenseCache creates a new license cache with the specified TTL
func NewLicenseCache(ttl time.Duration) *LicenseCache {
	return &LicenseCache{
		cache: make(map[string]*LicenseCacheEntry),
		ttl:   ttl,
	}
}

// Get retrieves cached license information for an account
func (lc *LicenseCache) Get(accountID string) ([]string, bool) {
	lc.mu.RLock()
	defer lc.mu.RUnlock()

	entry, exists := lc.cache[accountID]
	if !exists || entry.IsExpired() {
		return nil, false
	}

	return entry.LicensedModules, true
}

// Set stores license information for an account in the cache
func (lc *LicenseCache) Set(accountID string, licensedModules []string) {
	lc.mu.Lock()
	defer lc.mu.Unlock()

	lc.cache[accountID] = &LicenseCacheEntry{
		LicensedModules: licensedModules,
		CachedAt:        time.Now(),
		TTL:             lc.ttl,
	}
}

// CleanExpired removes expired entries from the cache
func (lc *LicenseCache) CleanExpired() {
	lc.mu.Lock()
	defer lc.mu.Unlock()

	for accountID, entry := range lc.cache {
		if entry.IsExpired() {
			delete(lc.cache, accountID)
		}
	}
}

// Size returns the current number of entries in the cache
func (lc *LicenseCache) Size() int {
	lc.mu.RLock()
	defer lc.mu.RUnlock()
	return len(lc.cache)
}

// Clear removes all entries from the cache
func (lc *LicenseCache) Clear() {
	lc.mu.Lock()
	defer lc.mu.Unlock()
	lc.cache = make(map[string]*LicenseCacheEntry)
}

// Global license cache instance
var globalLicenseCache *LicenseCache
var cacheInitOnce sync.Once

// GetGlobalLicenseCache returns the global license cache instance
func GetGlobalLicenseCache(cacheTtl time.Duration, cleanInterval time.Duration) *LicenseCache {
	cacheInitOnce.Do(func() {
		globalLicenseCache = NewLicenseCache(cacheTtl)

		go func() {
			ticker := time.NewTicker(cleanInterval)
			defer ticker.Stop()

			for range ticker.C {
				globalLicenseCache.CleanExpired()
			}
		}()
	})
	return globalLicenseCache
}
