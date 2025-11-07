<!-- DASHBOARD HIGHLIGHTS  -->

<!-- 
some of the already uploaded projects of filled cards are just dummy data
no backend is behind it so they are to be replaced with django backend codes.
e.g Task-due, Team members,  Active projects etc
-->

<!-- This is the first version and it is open for any corrections or suggestion to improve it -->

<!-- # 🧩 Planova Dashboard — Backend Integration Guide

This document serves as a reference for connecting the **Planova Dashboard UI** to a Django backend. The current dashboard is built in **HTML, CSS, and JavaScript**, and uses **static/dummy data**. This guide outlines how to replace those static values with dynamic data from a REST API.

---

## 🚀 Overview

The dashboard contains the following components that require backend connectivity:

| UI Component              | Data Source Type      | Description                               |
|---------------------------|-----------------------|-------------------------------------------|
| Overview Widgets          | Counts                | Projects, Tasks, Teams                    |
| Kanban Board Preview      | Task Status Data      | To Do, In Progress, Review, Done          |
| Calendar Preview          | Events / Task Due     | By day of the week                        |
| Recent Activity           | Activity Feed         | Team activity log                         |
| Your Tasks                | Task List for User    | Assigned tasks with due dates             |

⚠️ All current content is static. Replace with dynamic API calls.

---

## 🛠️ Required API Endpoints

These are suggested endpoint structures and response formats the backend team can implement using Django REST Framework:

| Component                | Endpoint                     | Method | Sample Response             |
|--------------------------|------------------------------|--------|-----------------------------|
| Active Projects Count    | `/api/projects/active/count/` | GET    | `{ "count": 6 }`            |
| Tasks Due Count          | `/api/tasks/due/count/`       | GET    | `{ "count": 24 }`           |
| Overdue Items Count      | `/api/tasks/overdue/count/`   | GET    | `{ "count": 3 }`            |
| Team Members Count       | `/api/team/members/count/`    | GET    | `{ "count": 12 }`           |
| Kanban Board Data        | `/api/kanban/`                | GET    | `{ "todo": [...], "done": [...], ... }` |
| Assigned Tasks           | `/api/user/tasks/`            | GET    | `[{"title": "...", "due": "..."}]` |
| Recent Activity          | `/api/activity/`              | GET    | `[{"user": "John", "action": "completed task", "ago": "1 hour"}]` |

---

## 🧬 Suggested Django File Structure

 -->





<!-- # 🔐 Login Page — Complete Documentation

This document explains how the **Login Page UI** in the project works, how it’s structured, and how it should be connected to a backend authentication system (like Django). It is written to help both frontend and backend developers understand how to hook it up to a real API.

---

## 📄 Overview

The login page provides:

- A form for users to enter their email and password
- A login button that will call the backend when clicked
- A Google login button for OAuth login
- Links to "Reset Password" and "Register" pages
- Footer with links and social media icons

This is **version 1** of the page and currently uses static HTML/CSS — it does not yet submit real login data.

---

## 🧱 Tech Stack

| Part        | Technology Used |
|-------------|-----------------|
| Markup      | HTML5           |
| Styling     | CSS3            |
| Interaction | JavaScript (to be added) |
| Authentication Backend | (Recommended: Django Rest Framework) |

---

## 🖼️ UI Structure

### 📌 HTML Structure (Simplified)

```html
<form>
  <input type="email" id="email" required />
  <input type="password" id="password" required />
  <button type="submit">Log in</button>
  <button type="button" class="google-btn">Sign in with Google</button>
</form>
 -->




 <!-- # 📄 Planova — Reset Password / OTP Verification Page

## 📘 Introduction
The **Reset Password / OTP Verification** page is an essential component of the Planova authentication system. This interface prompts users to enter a **4-digit One-Time Password (OTP)** sent to their registered email address. Once entered correctly, users can securely proceed to reset their password or confirm their identity.

---

## 🧩 Features

### 🔐 OTP Input
- **4-digit code** entry, one number per input field.
- **Auto-focus behavior**: Cursor moves to the next input after a digit is entered.
- Smooth input experience with keyboard navigation (backspace supported).

### 🔄 Resend Code
- Users can request to resend the OTP once the countdown finishes.
- Timer updates dynamically next to the "Resend code" button.

### 🧼 Actions
- **Verify button** to validate OTP entry.
- **Clear button** to reset input fields.

### 🧭 Accessibility & Navigation
- Uses semantic HTML and ARIA roles for screen readers.
- Built with keyboard and mobile accessibility in mind.

### 📱 Responsive Design
- Fully responsive layout for desktop and mobile views.
- Columns stack and adjust for smaller screens.

---

## 🗂️ File Structure

 -->