"""
Main program to run the detection
"""

from argparse import ArgumentParser
import cv2
import mediapipe as mp
import numpy as np

# for TCP connection with unity
import socketio
from collections import deque
from platform import system

# face detection and facial landmark
from facial_landmark import FaceMeshDetector

# pose estimation and stablization
from pose_estimator import PoseEstimator
from stabilizer import Stabilizer

# Miscellaneous detections (eyes/ mouth...)
from facial_features import FacialFeatures, Eyes

# global variable
port = 5252         # have to be same as unity

# init TCP connection with unity
# return the socket connected
def init_TCP():
    s = socketio.Client()
    s.connect('http://localhost:5252/')
    return s

def send_info_to_web(s, data):
    s.emit('msg',data)

def print_debug_msg(data):
    print(data)

def threshold(v, L, H):
    if L<=v and v<=H: return 0
    if H<v : return 1
    if v<L : return -1

def main():

    cap = cv2.VideoCapture(args.cam)

    # Facemesh
    detector = FaceMeshDetector()

    # get a sample frame for pose estimation img
    success, img = cap.read()

    # Pose estimation related
    pose_estimator = PoseEstimator((img.shape[0], img.shape[1]))
    image_points = np.zeros((pose_estimator.model_points_full.shape[0], 2))

    # extra 10 points due to new attention model (in iris detection)
    iris_image_points = np.zeros((10, 2))

    # Introduce scalar stabilizers for pose.
    pose_stabilizers = [Stabilizer(
        state_num=2,
        measure_num=1,
        cov_process=0.1,
        cov_measure=0.1) for _ in range(6)]

    # for eyes
    eyes_stabilizers = [Stabilizer(
        state_num=2,
        measure_num=1,
        cov_process=0.1,
        cov_measure=0.1) for _ in range(6)]

    # for mouth_dist
    mouth_dist_stabilizer = Stabilizer(
        state_num=2,
        measure_num=1,
        cov_process=0.1,
        cov_measure=0.1
    )


    # Initialize TCP connection
    if args.connect:
        socket = init_TCP()

    while cap.isOpened():
        success, img = cap.read()

        if not success:
            print("Ignoring empty camera frame.")
            continue

        # Pose estimation by 3 steps:
        # 1. detect face;
        # 2. detect landmarks;
        # 3. estimate pose

        # first two steps
        img_facemesh, faces = detector.findFaceMesh(img)

        # flip the input image so that it matches the facemesh stuff
        img = cv2.flip(img, 1)

        # if there is any face detected
        if faces:
            # only get the first face
            for i in range(len(image_points)):
                image_points[i, 0] = faces[0][i][0]
                image_points[i, 1] = faces[0][i][1]
                
            for j in range(len(iris_image_points)):
                iris_image_points[j, 0] = faces[0][j + 468][0]
                iris_image_points[j, 1] = faces[0][j + 468][1]

            # The third step: pose estimation
            # pose: [[rvec], [tvec]]
            pose = pose_estimator.solve_pose_by_all_points(image_points)

            x_ratio_left, y_ratio_left = FacialFeatures.detect_iris(image_points, iris_image_points, Eyes.LEFT)
            x_ratio_right, y_ratio_right = FacialFeatures.detect_iris(image_points, iris_image_points, Eyes.RIGHT)


            ear_left = FacialFeatures.eye_aspect_ratio(image_points, Eyes.LEFT)
            ear_right = FacialFeatures.eye_aspect_ratio(image_points, Eyes.RIGHT)

            pose_eye = [ear_left, ear_right, x_ratio_left, y_ratio_left, x_ratio_right, y_ratio_right]

            mar = FacialFeatures.mouth_aspect_ratio(image_points)
            mouth_distance = FacialFeatures.mouth_distance(image_points)

            # print("left eye: %.2f, %.2f" % (x_ratio_left, y_ratio_left))
            # print("right eye: %.2f, %.2f" % (x_ratio_right, y_ratio_right))

            # print("rvec (y) = (%f): " % (pose[0][1]))
            # print("rvec (x, y, z) = (%f, %f, %f): " % (pose[0][0], pose[0][1], pose[0][2]))
            # print("tvec (x, y, z) = (%f, %f, %f): " % (pose[1][0], pose[1][1], pose[1][2]))

            # Stabilize the pose.
            steady_pose = []
            pose_np = np.array(pose).flatten()

            for value, ps_stb in zip(pose_np, pose_stabilizers):
                ps_stb.update([value])
                steady_pose.append(ps_stb.state[0])

            steady_pose = np.reshape(steady_pose, (-1, 3))

            # stabilize the eyes value
            steady_pose_eye = []
            for value, ps_stb in zip(pose_eye, eyes_stabilizers):
                ps_stb.update([value])
                steady_pose_eye.append(ps_stb.state[0])

            mouth_dist_stabilizer.update([mouth_distance])
            steady_mouth_dist = mouth_dist_stabilizer.state[0]

            # print("rvec steady (x, y, z) = (%f, %f, %f): " % (steady_pose[0][0], steady_pose[0][1], steady_pose[0][2]))
            # print("tvec steady (x, y, z) = (%f, %f, %f): " % (steady_pose[1][0], steady_pose[1][1], steady_pose[1][2]))

            # calculate the roll/ pitch/ yaw
            # roll: +ve when the axis pointing upward
            # pitch: +ve when we look upward
            # yaw: +ve when we look left
            # print(pose[0][0])
            # print(np.degrees(steady_pose[0][0]))
            if steady_pose[0][0] < 0 : steady_pose[0][0] = -steady_pose[0][0]
            
            roll = np.clip(np.degrees(steady_pose[0][1]), -30, 30) * 2
            pitch = np.clip(177 - abs(np.degrees(steady_pose[0][0])), -90, 90) * 3
            yaw =  np.clip(np.degrees(steady_pose[0][2]), -30, 30) + 3
            # print("Roll: %.2f, Pitch: %.2f, Yaw: %.2f" % (roll, pitch, yaw))
            # print("left eye: %.2f, %.2f; right eye %.2f, %.2f"
            #     % (steady_pose_eye[0], steady_pose_eye[1], steady_pose_eye[2], steady_pose_eye[3]))
            # print("EAR_LEFT: %.2f; EAR_RIGHT: %.2f" % (ear_left, ear_right))
            # print("MAR: %.2f; Mouth Distance: %.2f" % (mar, steady_mouth_dist))
            # eyeBallX = (x_ratio_left + x_ratio_right)/2
            # eyeBallX = -(steady_pose_eye[2][0] + steady_pose_eye[4][0])/2
            # eyeBallY = -(steady_pose_eye[3][0] + steady_pose_eye[5][0])/2
            eyeBallX = -(pose_eye[2] + pose_eye[4])/2
            eyeBallY = -(pose_eye[3] + pose_eye[5])/2
            
            data = {
                'roll': roll, 'pitch': pitch, 'yaw': yaw,
                'eyeLOpen': ear_left*6 - 2,
                'eyeROpen': ear_right*6 - 2,
                # 'eyeROpen': ear_right*6 - 2,
                'mouthOpen': mar*1.5,
                'mouthForm': threshold(mouth_distance,45,50) - 1, 
                # 'mouthForm': -3, 
                'eyeBallX': threshold(-eyeBallX,0.45,0.57),
                # 'eyeBallY': threshold(eyeBallY,-0.55,-0.35),
                'eyeBallY': 0,
            }
            # send info to web
            if args.connect:

                # for sending to live2d model (Hiyori)
                # send_info_to_web(socket,
                #     (roll, pitch, yaw,
                #     ear_left, ear_right, x_ratio_left, y_ratio_left, x_ratio_right, y_ratio_right,
                #     mar, mouth_distance)
                # )
                send_info_to_web(socket,data)

            if args.debug:
                # print(mouth_distance)
                # print(data['eyeLOpen'])
                # if data['eyeBallX'] != 0:
                #     print(data['eyeBallX'])
                pass


            # pose_estimator.draw_annotation_box(img, pose[0], pose[1], color=(255, 128, 128))

            # pose_estimator.draw_axis(img, pose[0], pose[1])

            pose_estimator.draw_axes(img_facemesh, steady_pose[0], steady_pose[1])

        else:
            # reset our pose estimator
            pose_estimator = PoseEstimator((img_facemesh.shape[0], img_facemesh.shape[1]))

        if args.debug:
            cv2.imshow('Facial landmark', img_facemesh)
   
        # press "q" to leave
        if cv2.waitKey(1) & 0xFF == ord('q'):
            socket.disconnect()
            break

    cap.release()


if __name__ == "__main__":

    parser = ArgumentParser()
    parser.add_argument("--cam", type=int,
                        help="specify the camera number if you have multiple cameras",
                        default=0)

    parser.add_argument("--connect", action="store_true",
                        help="connect to unity character",
                        default=False)

    parser.add_argument("--debug", action="store_true",
                        help="showing the camera's image for debugging",
                        default=False)
    args = parser.parse_args()

    # demo code
    main()
