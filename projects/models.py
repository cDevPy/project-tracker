from django.db import models
from django.contrib.auth.models import User

class Project(models.Model):
    # This connects the project to the specific user who logged in
    owner = models.ForeignKey(User, on_delete=models.CASCADE)
    # This allows multiple users to be part of a project
    members = models.ManyToManyField(User, related_name='projects_joined', blank=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class Task(models.Model):
    STATUS_CHOICES = [
        ('todo', 'To Do'),
        ('inprogress', 'In Progress'),
        ('review', 'Review'),
        ('done', 'Done'),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    assignee = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='todo')
    due_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return self.title
