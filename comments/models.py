from django.db import models
# from tasks.models import Task
# from django.contrib.auth.models import User

# Create your models here.

# class Comment(models.Model):
#     task = models.ForeignKey(Task, on_delete=models.CASCADE)
#     user = models.ForeignKey(User, on_delete=models.CASCADE)
#     comment = models.TextField()
#     created_at = models.DateTimeField(auto_add_now=True)

#     def _str_(self):
#         return f"{self.user.username} commented on {self.task.title}"