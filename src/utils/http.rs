use anyhow::Result;
use reqwest::{Client, ClientBuilder, header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE}};
use std::time::Duration;
use backoff::{ExponentialBackoff, future::retry};
use serde::de::DeserializeOwned;
use serde_json::Value;

#[derive(Clone)]
pub struct HttpClient {
    client: Client,
    base_url: String,
    default_headers: HeaderMap,
}

impl HttpClient {
    pub fn new(base_url: String) -> Result<Self> {
        let client = ClientBuilder::new()
            .timeout(Duration::from_secs(30))
            .build()?;

        let mut default_headers = HeaderMap::new();
        default_headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

        Ok(Self {
            client,
            base_url: base_url.trim_end_matches('/').to_string(),
            default_headers,
        })
    }

    pub fn with_api_key(mut self, api_key: &str) -> Self {
        let auth_value = HeaderValue::from_str(&format!("Bearer {}", api_key))
            .expect("Invalid API key format");
        self.default_headers.insert(AUTHORIZATION, auth_value);
        self
    }

    pub fn with_secret(mut self, secret: &str) -> Self {
        let auth_value = HeaderValue::from_str(&format!("Bearer {}", secret))
            .expect("Invalid secret format");
        self.default_headers.insert(AUTHORIZATION, auth_value);
        self
    }

    pub async fn get<T>(&self, path: &str) -> Result<T>
    where
        T: DeserializeOwned,
    {
        let url = format!("{}/{}", self.base_url, path.trim_start_matches('/'));
        
        let operation = || async {
            let response = self.client
                .get(&url)
                .headers(self.default_headers.clone())
                .send()
                .await?;

            if response.status().is_success() {
                let json: T = response.json().await?;
                Ok(json)
            } else {
                let status = response.status();
                let text = response.text().await.unwrap_or_default();
                anyhow::bail!("HTTP {} error: {}", status, text);
            }
        };

        retry(ExponentialBackoff::default(), operation).await
    }

    pub async fn post<T, B>(&self, path: &str, body: &B) -> Result<T>
    where
        T: DeserializeOwned,
        B: serde::Serialize,
    {
        let url = format!("{}/{}", self.base_url, path.trim_start_matches('/'));
        
        let operation = || async {
            let response = self.client
                .post(&url)
                .headers(self.default_headers.clone())
                .json(body)
                .send()
                .await?;

            if response.status().is_success() {
                let json: T = response.json().await?;
                Ok(json)
            } else {
                let status = response.status();
                let text = response.text().await.unwrap_or_default();
                anyhow::bail!("HTTP {} error: {}", status, text);
            }
        };

        retry(ExponentialBackoff::default(), operation).await
    }

    pub async fn put<T, B>(&self, path: &str, body: &B) -> Result<T>
    where
        T: DeserializeOwned,
        B: serde::Serialize,
    {
        let url = format!("{}/{}", self.base_url, path.trim_start_matches('/'));
        
        let operation = || async {
            let response = self.client
                .put(&url)
                .headers(self.default_headers.clone())
                .json(body)
                .send()
                .await?;

            if response.status().is_success() {
                let json: T = response.json().await?;
                Ok(json)
            } else {
                let status = response.status();
                let text = response.text().await.unwrap_or_default();
                anyhow::bail!("HTTP {} error: {}", status, text);
            }
        };

        retry(ExponentialBackoff::default(), operation).await
    }

    pub async fn delete(&self, path: &str) -> Result<()> {
        let url = format!("{}/{}", self.base_url, path.trim_start_matches('/'));
        
        let operation = || async {
            let response = self.client
                .delete(&url)
                .headers(self.default_headers.clone())
                .send()
                .await?;

            if response.status().is_success() {
                Ok(())
            } else {
                let status = response.status();
                let text = response.text().await.unwrap_or_default();
                anyhow::bail!("HTTP {} error: {}", status, text);
            }
        };

        retry(ExponentialBackoff::default(), operation).await
    }
}

pub fn format_url(base_url: &str, path: &str) -> String {
    format!("{}/{}", base_url.trim_end_matches('/'), path.trim_start_matches('/'))
}