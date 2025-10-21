use anyhow::Result;
use reqwest::{Client, Method, RequestBuilder, Response};
use serde::{de::DeserializeOwned, Serialize};
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, instrument};
use url::Url;

use crate::auth::AuthProvider;

pub struct HttpClient {
    client: Client,
    base_url: Url,
    auth_provider: Box<dyn AuthProvider>,
    user_agent: String,
}

impl HttpClient {
    pub fn new(
        base_url: impl AsRef<str>,
        auth_provider: Box<dyn AuthProvider>,
        user_agent: impl Into<String>,
        timeout: Option<Duration>,
    ) -> Result<Self> {
        let client = Client::builder()
            .timeout(timeout.unwrap_or(Duration::from_secs(30)))
            .build()?;
            
        let base_url = Url::parse(base_url.as_ref())?;
        
        Ok(Self {
            client,
            base_url,
            auth_provider,
            user_agent: user_agent.into(),
        })
    }
    
    #[instrument(skip(self))]
    pub async fn get<T: DeserializeOwned>(
        &self,
        path: &str,
        params: Option<HashMap<String, String>>,
        headers: Option<HashMap<String, String>>,
    ) -> Result<T> {
        let response = self.request(Method::GET, path, params, headers, None::<()>).await?;
        self.handle_response(response).await
    }
    
    #[instrument(skip(self, body))]
    pub async fn post<T: DeserializeOwned, B: Serialize>(
        &self,
        path: &str,
        params: Option<HashMap<String, String>>,
        headers: Option<HashMap<String, String>>,
        body: Option<B>,
    ) -> Result<T> {
        let response = self.request(Method::POST, path, params, headers, body).await?;
        self.handle_response(response).await
    }
    
    #[instrument(skip(self, body))]
    pub async fn put<T: DeserializeOwned, B: Serialize>(
        &self,
        path: &str,
        params: Option<HashMap<String, String>>,
        headers: Option<HashMap<String, String>>,
        body: Option<B>,
    ) -> Result<T> {
        let response = self.request(Method::PUT, path, params, headers, body).await?;
        self.handle_response(response).await
    }
    
    #[instrument(skip(self))]
    pub async fn delete<T: DeserializeOwned>(
        &self,
        path: &str,
        params: Option<HashMap<String, String>>,
        headers: Option<HashMap<String, String>>,
    ) -> Result<T> {
        let response = self.request(Method::DELETE, path, params, headers, None::<()>).await?;
        self.handle_response(response).await
    }
    
    async fn request<B: Serialize>(
        &self,
        method: Method,
        path: &str,
        params: Option<HashMap<String, String>>,
        headers: Option<HashMap<String, String>>,
        body: Option<B>,
    ) -> Result<Response> {
        let url = self.base_url.join(path)?;
        
        let mut request = self.client.request(method, url);
        
        // Add query parameters
        if let Some(params) = params {
            request = request.query(&params);
        }
        
        // Add authentication
        request = self.auth_provider.add_auth(request).await?;
        
        // Add user agent
        request = request.header("User-Agent", &self.user_agent);
        
        // Add custom headers
        if let Some(headers) = headers {
            for (key, value) in headers {
                request = request.header(key, value);
            }
        }
        
        // Add body if present
        if let Some(body) = body {
            request = request.json(&body);
        }
        
        debug!("Making HTTP request: {} {}", request.try_clone().unwrap().build()?.method(), request.try_clone().unwrap().build()?.url());
        
        let response = request.send().await?;
        
        debug!("Received response: {}", response.status());
        
        Ok(response)
    }
    
    async fn handle_response<T: DeserializeOwned>(&self, response: Response) -> Result<T> {
        let status = response.status();
        
        if status.is_success() {
            let data = response.json::<T>().await?;
            Ok(data)
        } else {
            let error_text = response.text().await?;
            anyhow::bail!("HTTP error {}: {}", status, error_text);
        }
    }
}