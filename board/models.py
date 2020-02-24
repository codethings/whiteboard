from django.db import models, transaction


class Board(models.Model):
    pass

    @classmethod
    def add_path(cls, board_id, path_data):
        # not doing any locks for now
        with transaction.atomic():
            path = Path.objects.create(board_id=board_id, color=path_data['color'])
            points = [
                Point(x=point[0], y=point[1], path_id=path.id)
                for point in path_data['points']
            ]
            Point.objects.bulk_create(points)

    @classmethod
    def get_board_data(cls, board_id):
        # {paths: {points: [[x, y], [x, y]], color: "foo"}}
        paths = Path.objects.filter(board_id=board_id).prefetch_related("points")
        data = {}
        data["paths"] = [
            {
                "color": path.color,
                "points": list(path.points.values_list("x", "y"))
            }
            for path in paths
        ]
        return data


class Path(models.Model):
    board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name="paths")
    color = models.CharField(max_length=128, default="black")


class Point(models.Model):
    x = models.IntegerField()
    y = models.IntegerField()
    path = models.ForeignKey(Path, on_delete=models.CASCADE, related_name="points")
