from django.db import models
#from django.contrib.auth.models import User
from django.conf import settings
import uuid
import random
import string
from django.utils import timezone
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.crypto import get_random_string
from django.utils import timezone
from datetime import timedelta




def get_invitation_expiry():
    """Return a datetime 7 days from now"""
    return timezone.now() + timedelta(days=7)


class Project(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='project_owner')
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='project_member')

    def __str__(self):
        return self.name

    def get_task_count(self):
        return self.task_set.count()


    


class ProjectMember(models.Model):
    ROLE_CHOICES = [
        ('owner', 'Owner'),
        ('admin', 'Admin'),
        ('member', 'Member'),
        ('viewer', 'Viewer'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='member')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'project')





def generate_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=5))



User = get_user_model()




def get_invitation_expiry():
    return timezone.now() + timedelta(days=7)


class Invitation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    project = models.ForeignKey('Project', on_delete=models.CASCADE, related_name='invitations')
    email = models.EmailField()
    
    ROLE_CHOICES = [
        ('Member', 'Member'),
        ('Admin', 'Admin'),
        ('Viewer', 'Viewer'),
    ]
    
    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='Member'
    )
    
    token = models.CharField(max_length=64, unique=True, blank=True)
    invited_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_invitations')
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('expired', 'Expired'),
        ('revoked', 'Revoked'),
    ]
    
    status = models.CharField(
        max_length=10,
        choices=STATUS_CHOICES,
        default='pending'
    )
    
    expires_at = models.DateTimeField(default=get_invitation_expiry)
    created_at = models.DateTimeField(auto_now_add=True)

    # Comment this out for now to avoid migration issues
    # class Meta:
    #     unique_together = ('project', 'email')

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = get_random_string(length=64)
        super().save(*args, **kwargs)

    def is_expired(self):
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"Invite to {self.email} for {self.project}"