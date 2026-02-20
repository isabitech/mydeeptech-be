const RoleType = {
    ADMIN: "admin",
    USER: "user",
    ANNOTATOR: "annotator",
    MODERATOR: "moderator",
    QA_REVIEWER: "qa_reviewer"
}

// Detailed permissions with metadata
const PermissionDetails = {
    view_dashboard: {
        id: 'view_dashboard',
        name: 'view_dashboard',
        category: 'dashboard',
        description: 'Access to view the main dashboard and overview metrics'
    },
    manage_users: {
        id: 'manage_users',
        name: 'manage_users',
        category: 'user_management',
        description: 'Create, update, delete and manage user accounts and roles'
    },
    manage_projects: {
        id: 'manage_projects',
        name: 'manage_projects',
        category: 'project_management',
        description: 'Create, update and manage annotation projects and configurations'
    },
    view_analytics: {
        id: 'view_analytics',
        name: 'view_analytics',
        category: 'analytics',
        description: 'View system analytics, metrics and performance data'
    },
    manage_assessments: {
        id: 'manage_assessments',
        name: 'manage_assessments',
        category: 'assessment_management',
        description: 'Create, update and manage assessment configurations'
    },
    system_config: {
        id: 'system_config',
        name: 'system_config',
        category: 'system',
        description: 'Configure system settings and global preferences'
    },
    view_reports: {
        id: 'view_reports',
        name: 'view_reports',
        category: 'reporting',
        description: 'Generate and view system reports and data exports'
    },
    moderate_content: {
        id: 'moderate_content',
        name: 'moderate_content',
        category: 'moderation',
        description: 'Review, approve, or reject content and annotations'
    },
    annotate_data: {
        id: 'annotate_data',
        name: 'annotate_data',
        category: 'annotation',
        description: 'Perform data annotation and labeling tasks'
    },
    review_annotations: {
        id: 'review_annotations',  
        name: 'review_annotations',
        category: 'quality_assurance',
        description: 'Review and validate annotation quality and accuracy'
    }
}

// Role permissions mapping
const RolePermissions = {
    ADMIN: ['view_dashboard', 'manage_users', 'manage_projects', 'view_analytics', 'manage_assessments', 'system_config', 'view_reports'],
    MODERATOR: ['view_dashboard', 'moderate_content', 'view_analytics', 'view_reports'],
    ANNOTATOR: ['view_dashboard', 'annotate_data'],
    QA_REVIEWER: ['view_dashboard', 'review_annotations', 'view_reports'],
    USER: ['view_dashboard']
}

// Helper function to get permission details for a role
const getRolePermissionsWithDetails = (role) => {
    const permissions = RolePermissions[role] || [];
    return permissions.map(permission => PermissionDetails[permission]).filter(Boolean);
}

module.exports = { RoleType, RolePermissions, PermissionDetails, getRolePermissionsWithDetails }