# AI Usage Log Template

## API Documentation

### File
file /backend/api-documentation/doc.yaml
### Date/Time:
2025-11-11 11:00
### Tool:
ChatGPT
### Prompt/Command:
Generated API documentation in OpenAPI 3.0 format
### Output Summary:
The output documentation was nicely formatted. However, some of the schema and example inputs were wrong.
### Action Taken:
- [ ] Accepted as-is
- [x] Modified
- [ ] Rejected
### Author Notes:
I added descriptions to the various API endpoints to explain their purpose.
I added the correct example inputs and outputs for the relevant APIs.

## Question Generation

### File
In the database
### Date/Time:
2025-11-10 12:00
### Tool:
ChatGPT
### Prompt/Command:
Generated questions to insert directly into the database via a temporary script under the question service.
### Output Summary:
The output was generated as a TypeScript snippet that was used to insert generated questions into the database under the question service.
### Action Taken:
- [ ] Accepted as-is
- [x] Modified
- [ ] Rejected
### Author Notes:
We checked for duplicated generated questions and topics, and manually deleted them from the script.

## Collab Service Debugging and Integration

### File
`collab-controller.ts`, `collab-model.ts`
### Date/Time:
2025-11-05 22:45
### Tool:
ChatGPT (GPT-5)
### Prompt/Command:
I asked for help for debugging on why users were unable to join session after matching. 
### Output Summary:
ChatGPT provided pinpointed that the issue is due to the handling of cookies in the websocket authorisation gateway. It also explained expected behaviors of error handling.
### Action Taken:
- [ ] Accepted as-is
- [x] Modified
- [ ] Rejected
### Author Notes:
-

---

## Collab Service Double Seeding Debugging

### File
`yws.ts`
### Date/Time:
2025-11-11 00:20
### Tool:
ChatGPT (GPT-5)
### Prompt/Command:
I asked for help where the initial template (seed) was inserted twice upon creating a room. 
### Output Summary:
ChatGPT gave a few fixes and there was some back and forth but eventually managed to suggest a possible cause and solution - to seed from the backend instead. 
### Action Taken:
- [ ] Accepted as-is
- [x] Modified
- [ ] Rejected
### Author Notes:
-

---

##  Deployment, Redis & Docker Setup Assistance

### File
`Dockerfile`, `docker-compose.yml`
### Date/Time:
2025-11-13 14:10
### Tool:
ChatGPT (GPT-5)
### Prompt/Command:
I asked it for help on how to set up redis on Google compute engine VM and integrate it with our containers
### Output Summary:
ChatGPT provided Docker Compose configuration examples and explained how to run containerized setups with proper environment variable mapping. It also gave a step-by-step on how to setup the Redis instance and linux commands required on the VM.
### Action Taken:
- [x] Accepted as-is
- [ ] Modified
- [ ] Rejected
### Author Notes:
Followed generated  guide for debugging; confirmed successful local connections without modifying design decisions.

## Yjs, Monaco and Database integration

### File
`yws.ts`, `collab.tsx`
### Date/Time:
2025-10-18 10:20
### Tool:
ChatGPT (GPT-5)
### Prompt/Command:
I asked for help on how we could go around integrating Yjs + Monaco with our postgresql database.
### Output Summary:
ChatGPT gave a few approaches on how we could do it. There was some back and forth before I decided to take its simpler approach to set up a base template.
### Action Taken:
- [ ] Accepted as-is
- [x] Modified
- [ ] Rejected
### Author Notes:
-


