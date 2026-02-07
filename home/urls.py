# home/urls.py
from django.urls import path
from home import views

urlpatterns = [
    path('', views.landing, name='home.landing'),
    path('dashboard/', views.dashboard, name='home.dashboard'),
    path('api/dashboard/counts/', views.dashboard_counts, name='dashboard_counts'),
    path('api/dashboard/full-data/', views.dashboard_full_data, name='dashboard_full_data'),
    path('api/projects/create/', views.create_project_api, name='create_project_api'),
    path('api/projects/<int:project_id>/', views.project_details, name='project_details'),
    path('api/projects/all/', views.get_all_projects, name='get_all_projects'),
    path('api/projects/<int:project_id>/members/', views.project_members, name='project_members'),
    path('api/projects/cleanup/', views.cleanup_duplicate_projects, name='cleanup_duplicate_projects'),
    path('api/projects/check-duplicate/', views.check_duplicate_project, name='check_duplicate_project'),
    path('api/tasks/create/', views.create_task_api, name='create_task_api'),
    path('api/tasks/update-status/', views.update_task_status, name='update_task_status'),
    path('api/tasks/<int:task_id>/', views.task_details, name='task_details'),
    path('api/tasks/<int:task_id>/update/', views.update_task_api, name='update_task_api'),
    path('api/tasks/<int:task_id>/comments/', views.task_comments, name='task_comments'),
    path('api/tasks/<int:task_id>/comments/add/', views.add_comment_api, name='add_comment_api'),
    path('api/tasks/<int:task_id>/delete/', views.delete_task_api, name='delete_task_api'),
    path('debug/tasks/', views.debug_tasks, name='debug_tasks'),
    path('debug/tasks/<int:project_id>/', views.debug_tasks, name='debug_tasks_project'),
    path('api/search/', views.search_all, name='search_all')
]