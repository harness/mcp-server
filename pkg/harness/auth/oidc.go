package auth

import (
	"context"
	"fmt"
	"net/http"
	"encoding/json"
	"io/ioutil"
	"strings"
)

type OIDCProvider struct {
	clientID     string
	clientSecret string
	tokenURL     string
}

// NewOIDCProvider creates a new OIDCProvider
func NewOIDCProvider(clientID, clientSecret, tokenURL string) *OIDCProvider {
	return &OIDCProvider{
		clientID:     clientID,
		clientSecret: clientSecret,
		tokenURL:     tokenURL,
	}
}

// GetHeader retrieves the authorization header using client credentials
func (p *OIDCProvider) GetHeader(ctx context.Context) (string, string, error) {
	client := &http.Client{}
	data := fmt.Sprintf("client_id=%s&client_secret=%s&grant_type=client_credentials", p.clientID, p.clientSecret)
	req, err := http.NewRequest("POST", p.tokenURL, strings.NewReader(data))
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := client.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("failed to retrieve token: %s", resp.Status)
	}

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", "", err
	}

	var result map[string]interface{}
	err = json.Unmarshal(body, &result)
	if err != nil {
		return "", "", err
	}

	token, ok := result["access_token"].(string)
	if !ok {
		return "", "", fmt.Errorf("access_token not found in response")
	}

	return "Authorization", fmt.Sprintf("Bearer %s", token), nil
}
