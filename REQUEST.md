# 🔐 Authentication API (NestJS + JWT)

This project uses JWT-based authentication with NestJS, Prisma, and Passport.

---

## 🚀 Base URL
[http://localhost:3000](http://localhost:3000)

---

## 📌 Endpoints Overview

- `POST /auth/signup` → Create a new user
- `POST /auth/login` → Authenticate user and get JWT
- `GET /users` → Get authenticated user profile (protected)

---

## 🧑‍💻 1. Signup

Create a new user account.

### Request

```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "123456"
  }'
````

### Response

```json
{
  "access_token": "JWT_TOKEN_HERE"
}
```

---

## 🔑 2. Login

Authenticate existing user and receive JWT token.

### Request

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "123456"
  }'
```

### Response

```json
{
  "access_token": "JWT_TOKEN_HERE"
}
```

---

## 🛡️ 3. Get Own Profile (Protected)

Fetch the authenticated user's profile.

### Request

```bash
curl -X GET http://localhost:3000/users \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Response

```json
{
  "userId": 1,
  "email": "test@test.com"
}
```

---

## 🔐 Authentication Notes

* Use JWT in Authorization header:

```
Authorization: Bearer <token>
```

* Token is returned from signup/login
* Protected routes require valid JWT
