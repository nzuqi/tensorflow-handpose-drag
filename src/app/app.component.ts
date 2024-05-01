import { AfterViewInit, Component, ElementRef, ViewChild } from '@angular/core';
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewInit {
  logger: any = {};
  position: { x: number, y: number } = { x: 200, y: 100 };

  @ViewChild('video') video!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;

  stream: MediaStream | any;
  keypoints: any = {};

  ngAfterViewInit(): void {
    this.initialize();
  }

  initialize(): void {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false, })
      .then(async (stream) => {
        this.stream = stream;
        const model = handPoseDetection.SupportedModels.MediaPipeHands;
        const detectorConfig: any = {
          runtime: 'mediapipe',
          solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands',
          modelType: 'full'
        };
        const detector = await handPoseDetection.createDetector(model, detectorConfig);
        return detector;
      })
      .then((model: any) => {
        const context: any = this.canvas.nativeElement.getContext('2d');
        context.clearRect(0, 0, this.video.nativeElement.width, this.video.nativeElement.height);
        context.strokeStyle = 'red';
        context.fillStyle = 'red';
        context.lineWidth = 3;

        context.translate(this.canvas.nativeElement.width, 0);
        context.scale(-1, 1);
        const runDetection = () => {
          model.estimateHands(this.video.nativeElement).then((predictions: any) => {
            context.drawImage(
              this.video.nativeElement,
              0,
              0,
              this.video.nativeElement.width,
              this.video.nativeElement.height,
              0,
              0,
              this.canvas.nativeElement.width,
              this.canvas.nativeElement.height
            );
            if (predictions?.length) {
              this.keypoints = predictions[0].keypoints;
              this.drawKeypoints(context, this.keypoints);
              this.log({ info: "Hand detected..." });
              this.dragItem();
            } else {
              this.log(null);
            }
            requestAnimationFrame(runDetection);
          });
        };
        runDetection();
      })
      .catch((err) => {
        console.error(err);
      });
  }

  private get fingerLookupIndices(): any {
    return {
      thumb: [0, 1, 2, 3, 4],
      indexFinger: [0, 5, 6, 7, 8],
      middleFinger: [0, 9, 10, 11, 12],
      ringFinger: [0, 13, 14, 15, 16],
      pinky: [0, 17, 18, 19, 20],
    };
  }

  private drawKeypoints(ctx: any, keypoints: any[]): void {
    // trace fingers with lines...
    const fingers = Object.keys(this.fingerLookupIndices);
    for (let i = 0; i < fingers.length; i++) {
      const finger = fingers[i];
      const points = this.fingerLookupIndices[finger].map((idx: number) => keypoints[idx]);
      this.drawPath(ctx, points);
    }
    // trace joints & edges with points
    for (let y = 0; y < keypoints.length; y++) {
      const keypoint = keypoints[y];
      this.drawPoint(ctx, keypoint.y, keypoint.x, 4);
    }
  };

  private drawPoint(ctx: any, y: number, x: number, r: number): void {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI, false);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  private drawPath(ctx: any, points: any, closePath: boolean = false): any {
    const region = new Path2D();
    region.moveTo(points.x, points.y);
    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      region.lineTo(point.x, point.y);
    }

    if (closePath) region.closePath();
    ctx.stroke(region);
  }

  private dragItem(): void {
    const offset = 40;
    const thumb: any = this.keypoints.find((f: any) => f?.name == 'thumb_tip');
    const index: any = this.keypoints.find((f: any) => f?.name == 'index_finger_tip');

    if (this.getDistBetween(thumb, index) <= offset &&
      this.getDistBetween(thumb, this.position) <= offset &&
      this.getDistBetween(index, this.position) <= offset) {
      this.position.x = index.x - (offset * 0.5);
      this.position.y = index.y;

      this.log({ info: "Dragging red circle on canvas...", ...this.position });
    }
  }

  private getDistBetween(p1: any, p2: any): number {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  }

  private log(message: any): void {
    this.logger = message ? { message, hand: this.keypoints } : {};
  }
}
