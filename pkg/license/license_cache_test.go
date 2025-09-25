package license

import (
	"testing"
	"time"
)

func TestLicenseCache_BasicOperations(t *testing.T) {
	cache := NewLicenseCache(30 * time.Minute)

	// Test empty cache
	if _, found := cache.Get("account1"); found {
		t.Error("Expected empty cache to return false")
	}

	// Test set and get
	modules := []string{"CORE", "CI", "CD"}
	cache.Set("account1", modules)

	if cachedModules, found := cache.Get("account1"); !found {
		t.Error("Expected to find cached modules")
	} else if len(cachedModules) != 3 {
		t.Errorf("Expected 3 modules, got %d", len(cachedModules))
	}

	// Test cache size
	if size := cache.Size(); size != 1 {
		t.Errorf("Expected cache size 1, got %d", size)
	}
}

func TestLicenseCache_TTLExpiration(t *testing.T) {
	// Create cache with very short TTL
	cache := NewLicenseCache(10 * time.Millisecond)

	modules := []string{"CORE", "CI"}
	cache.Set("account1", modules)

	// Should be available immediately
	if _, found := cache.Get("account1"); !found {
		t.Error("Expected to find cached modules immediately after set")
	}

	// Wait for expiration
	time.Sleep(20 * time.Millisecond)

	// Should be expired now
	if _, found := cache.Get("account1"); found {
		t.Error("Expected cached modules to be expired")
	}
}

func TestLicenseCache_CleanExpired(t *testing.T) {
	cache := NewLicenseCache(10 * time.Millisecond)

	// Add multiple entries
	cache.Set("account1", []string{"CORE"})
	cache.Set("account2", []string{"CORE", "CI"})

	if size := cache.Size(); size != 2 {
		t.Errorf("Expected cache size 2, got %d", size)
	}

	// Wait for expiration
	time.Sleep(20 * time.Millisecond)

	// Clean expired entries
	cache.CleanExpired()

	if size := cache.Size(); size != 0 {
		t.Errorf("Expected cache size 0 after cleanup, got %d", size)
	}
}

func TestLicenseCache_Clear(t *testing.T) {
	cache := NewLicenseCache(30 * time.Minute)

	// Add entries
	cache.Set("account1", []string{"CORE"})
	cache.Set("account2", []string{"CORE", "CI"})

	if size := cache.Size(); size != 2 {
		t.Errorf("Expected cache size 2, got %d", size)
	}

	// Clear cache
	cache.Clear()

	if size := cache.Size(); size != 0 {
		t.Errorf("Expected cache size 0 after clear, got %d", size)
	}

	// Verify entries are gone
	if _, found := cache.Get("account1"); found {
		t.Error("Expected account1 to be cleared from cache")
	}
}

func TestLicenseCache_ConcurrentAccess(t *testing.T) {
	cache := NewLicenseCache(30 * time.Minute)

	// Test concurrent writes and reads
	done := make(chan bool, 2)

	// Writer goroutine
	go func() {
		for i := 0; i < 100; i++ {
			cache.Set("account1", []string{"CORE", "CI"})
		}
		done <- true
	}()

	// Reader goroutine
	go func() {
		for i := 0; i < 100; i++ {
			cache.Get("account1")
		}
		done <- true
	}()

	// Wait for both goroutines to complete
	<-done
	<-done

	// Should not panic and should have the entry
	if _, found := cache.Get("account1"); !found {
		t.Error("Expected to find cached modules after concurrent access")
	}
}

func TestLicenseCacheEntry_IsExpired(t *testing.T) {
	// Test non-expired entry
	entry := &LicenseCacheEntry{
		LicensedModules: []string{"CORE"},
		CachedAt:        time.Now(),
		TTL:             30 * time.Minute,
	}

	if entry.IsExpired() {
		t.Error("Expected entry to not be expired")
	}

	// Test expired entry
	expiredEntry := &LicenseCacheEntry{
		LicensedModules: []string{"CORE"},
		CachedAt:        time.Now().Add(-1 * time.Hour), // 1 hour ago
		TTL:             30 * time.Minute,
	}

	if !expiredEntry.IsExpired() {
		t.Error("Expected entry to be expired")
	}
}

func TestGetGlobalLicenseCache(t *testing.T) {
	// Test that global cache is initialized
	cache1 := GetGlobalLicenseCache(30*time.Minute, 10*time.Minute)
	if cache1 == nil {
		t.Error("Expected global cache to be initialized")
	}

	// Test that subsequent calls return the same instance
	cache2 := GetGlobalLicenseCache(30*time.Minute, 10*time.Minute)
	if cache1 != cache2 {
		t.Error("Expected global cache to be singleton")
	}

	// Test that cache works
	cache1.Set("test", []string{"CORE"})
	if modules, found := cache2.Get("test"); !found || len(modules) != 1 {
		t.Error("Expected global cache to work across instances")
	}
}
