from django.db import models
from django.conf import settings


class Notification(models.Model):

    NOTIFICATION_TYPES = [
        ('project_join', 'Project Join'),
        ('invite_accepted', 'Invite Accepted'),   # NEW
        ('task_assign', 'Task Assigned'),
        ('deadline', 'Deadline Reminder'),
        ('system', 'System Notification'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    related_invitation = models.ForeignKey(
        'projects.Invitation',
        null=True, blank=True,
        on_delete=models.SET_NULL,        # changed from CASCADE so deleting invite doesn't wipe notification
        related_name='notifications'
    )
    related_project = models.ForeignKey(  # NEW — lets notification link directly to project
        'projects.Project',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='notifications'
    )
    type = models.CharField(max_length=50, choices=NOTIFICATION_TYPES)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user} - {self.type}"