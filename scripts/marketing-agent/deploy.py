"""
Deploy the Freehold Marketing Expert agent to Vertex AI Agent Engine.

Usage:
  pip install -r requirements.txt
  python deploy.py

After deployment, copy the printed resource ID into lib/google/vertex-agent.ts
and switch the call from Gemini direct to :streamQuery.
"""

import json
import os

import vertexai
from vertexai import agent_engines
from vertexai.preview.reasoning_engines import AdkApp

from agent import marketing_agent

PROJECT_ID      = "gen-lang-client-0814069297"
LOCATION        = "us-central1"
# Create this bucket first if it doesn't exist:
#   gsutil mb -l us-central1 gs://gen-lang-client-0814069297-adk-staging
# Or set the env var to an existing bucket:
#   export GCS_STAGING_BUCKET=gs://your-existing-bucket
STAGING_BUCKET  = os.environ.get("GCS_STAGING_BUCKET", f"gs://{PROJECT_ID}-adk-staging")

# ── Auth: use the service account JSON if available ───────────────────────────
cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
sa_json   = os.environ.get("VERTEX_AI_SERVICE_ACCOUNT_JSON")

if sa_json and not cred_path:
    # Write to a temp file for the SDK
    import tempfile
    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False)
    tmp.write(sa_json)
    tmp.close()
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = tmp.name
    print(f"Using service account: {json.loads(sa_json).get('client_email')}")

# ── Deploy ─────────────────────────────────────────────────────────────────────

print(f"Using staging bucket: {STAGING_BUCKET}")
vertexai.init(project=PROJECT_ID, location=LOCATION, staging_bucket=STAGING_BUCKET)

app = AdkApp(
    agent=marketing_agent,
    enable_tracing=True,
)

print("Deploying Freehold Marketing Expert to Vertex AI Agent Engine…")
print("(This takes ~3–5 minutes)")

remote_agent = agent_engines.create(
    app,
    requirements=[
        "google-cloud-aiplatform[adk,reasoningengine]>=1.79.0",
    ],
    display_name="Freehold Marketing Expert",
    description="Google & Meta Ads marketing expert for Dubai real estate (Freehold)",
)

resource_name = remote_agent.resource_name
resource_id   = resource_name.split("/")[-1]

print("\n✓ Deployed successfully!")
print(f"  Resource name : {resource_name}")
print(f"  Resource ID   : {resource_id}")
print()
print("Next step — update lib/google/vertex-agent.ts:")
print(f'  const REASONING_ENGINE_ID = "{resource_id}"')
print()
print("The agent now exposes query() and stream_query() — switch the API call")
print("from Gemini direct back to the reasoning engine :streamQuery endpoint.")
