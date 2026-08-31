Architecture Advisor Agent Proposal  
Design Stage – Reviewable Architecture Proposal  
Project: To do list  
Environment: Dev

---

## 1. Architecture Recommendations

### 1.1 Solution Overview

- **User-facing to-do list application** (web/mobile UI)
- **Backend service** for CRUD operations and SMS delivery
- **Integration with SMS API** (Azure Communication Services or Twilio)
- **Data storage** (local DB or Azure cloud DB)
- **API contracts** for frontend-backend and backend-SMS provider
- **Security and threat model** for handling phone numbers and SMS delivery

---

### 1.2 High-Level Architecture Diagram (Textual)

```
[User UI] <-> [API Gateway (Azure API Management)] <-> [Backend Service] <-> [DB]
                                                        |
                                                        v
                                              [SMS API Provider]
```

---

## 2. Architecture Decision Records (ADR)

### ADR-001: SMS Provider Selection

- **Decision:** Use Azure Communication Services for SMS delivery (preferred for Azure-native integration; fallback: Twilio).
- **Rationale:** Native Azure integration, easier credential management, compliance alignment.
- **Alternatives:** Twilio (if Azure SMS is unavailable).
- **Implications:** Requires Azure account, SMS API provisioning, phone number validation.

### ADR-002: Data Storage

- **Decision:** Use Azure Table Storage or Cosmos DB for to-do items.
- **Rationale:** Cloud-native, scalable, low operational overhead.
- **Alternatives:** Local SQLite (for simple dev/test).
- **Implications:** Requires Azure resource setup, connection string management.

### ADR-003: API Management

- **Decision:** All API operations routed through Azure API Management.
- **Rationale:** Centralized security, throttling, logging, and contract enforcement.
- **Implications:** API versioning, policy configuration, auditability.

---

## 3. Data and API Contracts

### 3.1 To-Do Item (Data Contract)

```json
{
  "id": "string",
  "userId": "string",
  "task": "string",
  "completed": "boolean",
  "createdAt": "datetime",
  "updatedAt": "datetime"
}
```

### 3.2 Reminder Request (API Contract)

```json
{
  "userId": "string",
  "phoneNumber": "string",
  "tasks": [
    {
      "id": "string",
      "task": "string"
    }
  ]
}
```

### 3.3 API Endpoints

- `POST /api/todo` – Create to-do item
- `GET /api/todo` – List to-do items
- `PUT /api/todo/{id}` – Update to-do item
- `DELETE /api/todo/{id}` – Delete to-do item
- `POST /api/reminder` – Send selected tasks to phone number via SMS

---

## 4. Threat Model Considerations

### 4.1 Data Handling

- Treat all input (task text, phone numbers) as untrusted
- Validate and sanitize phone numbers (E.164 format)
- Protect against injection attacks in task text

### 4.2 API Security

- Use Azure API Management for authentication and throttling
- Rate-limit SMS sending to prevent abuse
- Log all reminder requests for audit

### 4.3 Credential Management

- Store SMS API credentials in Azure Key Vault
- Never expose secrets in code or logs

### 4.4 Privacy

- Do not persist phone numbers beyond what is necessary for delivery
- Provide user consent/notice for SMS reminders

---

## 5. Implementable Technical Plan

### 5.1 Components

- **Frontend:** Web/mobile UI (React or Flutter recommended)
- **Backend:** Node.js/Express or Azure Functions (for CRUD and SMS)
- **DB:** Azure Table Storage or Cosmos DB
- **SMS Integration:** Azure Communication Services SDK
- **API Gateway:** Azure API Management

### 5.2 Steps

1. **Provision Azure resources:** DB, Communication Services, API Management, Key Vault
2. **Design and implement data model:** To-do item schema
3. **Develop backend APIs:** CRUD and reminder endpoints
4. **Integrate SMS API:** Implement phone number validation and SMS sending logic
5. **Build frontend UI:** Task management, phone number input, task selection for reminders
6. **Configure API Management:** Secure endpoints, set policies, enable logging
7. **Implement threat mitigations:** Input validation, credential storage, auditing
8. **Test end-to-end:** CRUD, reminder delivery, security checks

---

## 6. Reviewable Summary Table

| Component         | Recommendation                  | Rationale                       | Risks/Mitigations               |
|-------------------|---------------------------------|----------------------------------|---------------------------------|
| SMS Provider      | Azure Communication Services     | Azure-native, compliance         | API limits, fallback: Twilio    |
| Data Storage      | Azure Table/Cosmos DB           | Cloud-native, scalable           | Cost, fallback: local SQLite    |
| API Gateway       | Azure API Management             | Centralized security             | Policy misconfig, audit logs    |
| Backend           | Node.js/Express or Azure Funcs   | Fast dev, Azure integration      | Language choice, Azure limits   |
| Frontend          | React/Flutter                    | Fast UI dev, cross-platform      | UI complexity, accessibility    |

---

## 7. Approval Gate

- This proposal is ready for review.
- Human approval required before implementation.
- All architecture decisions, contracts, and threat mitigations are documented.

---

**References:**  
- [Requirements Document](https://github.com/csdmichael/to-do-list/blob/main/docs/intake/requirements/to-do-list-requirements.md)
- [Requirements Agent Output](https://github.com/csdmichael/to-do-list/blob/main/docs/requirements-analysis.md)

---

**Next Step:**  
- Review and approve this architecture proposal.  
- Upon approval, proceed to detailed design and implementation.