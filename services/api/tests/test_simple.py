from fastapi.testclient import TestClient
from main import app


def test_multisource_workspace_and_grounded_tutor():
    client = TestClient(app)
    first = client.post("/upload", files={"file": ("networks.txt", b"Neural Networks\nBackpropagation adjusts weights using gradients.", "text/plain")})
    assert first.status_code == 200
    workspace_id = first.json()["workspace_id"]
    second = client.post("/upload", data={"workspace_id": workspace_id}, files={"file": ("optimization.md", b"# Optimization\nGradient descent reduces a loss function.", "text/markdown")})
    assert second.status_code == 200
    assert len(second.json()["sources"]) == 2
    answer = client.post("/tutor", json={"workspace_id": workspace_id, "question": "How are weights adjusted?"})
    assert answer.status_code == 200
    assert answer.json()["citations"]
    assert answer.json()["citations"][0]["filename"] in {"networks.txt", "optimization.md"}


def test_rejects_unsupported_files():
    client = TestClient(app)
    response = client.post("/upload", files={"file": ("payload.exe", b"no", "application/octet-stream")})
    assert response.status_code == 400
