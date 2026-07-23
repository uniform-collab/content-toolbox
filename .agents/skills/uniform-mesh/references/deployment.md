# Deployment

## Production deployment

1. Deploy to your hosting provider (Vercel, Netlify, etc.) with HTTPS: either as a static build or as a dynamic server-side application if custom API endpoints are needed.
2. Update `baseLocationUrl` in the manifest to the production URL
3. Re-register: `npm run register-to-team`
4. Test all locations in the Uniform dashboard

## Hosting requirements

- Browser must be able to reach both the app URL and `https://uniform.app`
- HTTPS required for production (HTTP allowed for localhost during development)
- Configure appropriate CORS headers for API endpoints

## Security considerations

- Store sensitive data in data source configuration (headers, variables), not in settings or custom public config — data source values are encrypted
- Use the `headers` array in data source configuration for authentication tokens
- Never expose API keys in client-side code
- Use environment variables to store credentials and other sensitive data that is not a data source configuration value but is needed by the integration (e.g. API keys, to pull in APIs for a reporting dashboard integration)
- All production integrations must use HTTPS

## Testing

- Use the "Test Data Type" function in the Uniform dashboard to verify data connectors
- Test with various data configurations
- Verify error handling and edge cases
