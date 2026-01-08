from django.db import models
#from django.contrib.auth.models import User
from django.conf import settings

# Create your models here.

class Project(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='project_owner')
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='project_member')

    def _str_(self):
        return self.name

    def get_task_count(self):
        return self.task_set.count()