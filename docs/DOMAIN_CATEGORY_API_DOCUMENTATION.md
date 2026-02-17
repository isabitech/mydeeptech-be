# 🗂️ Category, SubCategory, and Domain API Documentation

## Overview
This API provides a comprehensive management system for organizing projects and resources into a hierarchical structure:
- **Categories**: Top-level classification.
- **SubCategories**: Nested classifications within Categories.
- **Domains**: Specific areas of expertise or interest that can be linked to either Categories or SubCategories.

## Base URL
- **Development**: `http://localhost:5000/api`
- **Production**: `https://api.mydeeptech.ng/api`

---

## 🔐 Authentication
Most management routes (POST, PUT, DELETE) require administrative privileges.
- Include the JWT token in the `Authorization` header: `Bearer {admin_token}`
- Some GET routes may be public or require a standard user token.

---

## 📁 Category Management

### 1. Create a Category
**Endpoint:** `POST /categories`  
**Description:** Create a new top-level project category.

#### Request Body
```json
{
  "name": "string",
  "slug": "string"
}
```

#### Responses
- **201 Created**: Category created successfully.
- **400 Bad Request**: Missing required fields or duplicate slug.

---

### 2. Update a Category
**Endpoint:** `PUT /categories/{id}`  
**Description:** Modify an existing category's details.

#### Parameters
| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | Yes | The Category ID |

#### Request Body
```json
{
  "name": "string",
  "slug": "string"
}
```

#### Responses
- **200 OK**: Category updated successfully.
- **404 Not Found**: Category ID does not exist.

---

### 3. Delete a Category
**Endpoint:** `DELETE /categories/{id}`  
**Description:** Remove a category from the system.

#### Parameters
| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `id` | path | string | Yes | The Category ID |

#### Responses
- **200 OK**: Category deleted successfully.
- **404 Not Found**: Category ID does not exist.

---

### 4. Get Category Tree
**Endpoint:** `GET /categories/tree`  
**Description:** Retrieve the full hierarchical structure of categories, subcategories, and domains.

#### Responses
- **200 OK**: Returns the nested tree structure.
```json
{
  "success": true,
  "data": [
    {
      "_id": "60f7b...",
      "name": "Technology",
      "slug": "technology",
      "subCategories": [
        {
          "_id": "60f7c...",
          "name": "Software Development",
          "domains": [...]
        }
      ],
      "domains": [...]
    }
  ]
}
```

---

## 📂 SubCategory Management

### 1. Create a SubCategory
**Endpoint:** `POST /subcategories`  
**Description:** Create a subcategory nested under a parent category.

#### Request Body
```json
{
  "name": "string",
  "slug": "string",
  "category": "string" (Category ID)
}
```

#### Responses
- **201 Created**: Subcategory created successfully.

---

### 2. Update a SubCategory
**Endpoint:** `PUT /subcategories/{id}`  
**Description:** Update subcategory information.

#### Request Body
```json
{
  "name": "string",
  "slug": "string",
  "category": "string" (Category ID)
}
```

---

### 3. Get SubCategories by Category
**Endpoint:** `GET /subcategories/by-category/{categoryId}`  
**Description:** Fetch all subcategories belonging to a specific category.

#### Parameters
| Name | In | Type | Required | Description |
|------|----|------|----------|-------------|
| `categoryId` | path | string | Yes | The parent Category ID |

---

## 🌐 Domain Management

### 1. Create a Domain
**Endpoint:** `POST /domains`  
**Description:** Create a domain linked to either a Category or a SubCategory.

#### Request Body
```json
{
  "name": "string",
  "slug": "string",
  "parent": "string" (Parent ID),
  "parentModel": "string" ("Category" or "SubCategory")
}
```

#### Responses
- **201 Created**: Domain created successfully.

---

### 2. Get Domains by Parent
**Endpoint:** `GET /domains/by-parent`  
**Description:** Filter domains based on their parent entity.

#### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `parentId` | string | Yes | The ID of the parent |
| `parentModel` | string | Yes | Either `Category` or `SubCategory` |

---

## 🛠️ Integration Example (JavaScript)

```javascript
// Fetch the full category tree
const getCategoryTree = async () => {
  const response = await fetch('https://api.mydeeptech.ng/api/categories/tree');
  const result = await response.json();
  if (result.success) {
    console.log('Tree Structure:', result.data);
  }
};
```

---

*Last Updated: February 14, 2026*
