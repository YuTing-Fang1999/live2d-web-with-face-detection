
from PIL import Image
import cv2
import lic
import numpy as np
# from pointillism import *
from utils import rgba2rgb

def getLICTexture(img):


    gray = cv2.cvtColor(img, cv2.COLOR_BGRA2GRAY)
    blur = cv2.GaussianBlur(gray, (3,3), 1.3, 1.3)
    Gx = cv2.Sobel(blur, cv2.CV_64F, 1, 0)
    Gy = cv2.Sobel(blur, cv2.CV_64F, 0, 1)


    print(Gx.shape, Gy.shape)
    lic_result = lic.lic(Gx, -Gy, length=100)
    print(np.max(lic_result), np.min(lic_result))

    # plt.imshow(lic_result, origin='lower', cmap='gray')
    # plt.show()

    lic_result = cv2.normalize(lic_result, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)

    return lic_result


kelvin_table = {
    1000: (255,56,0),
    1500: (255,109,0),
    2000: (255,137,18),
    2500: (255,161,72),
    3000: (255,180,107),
    3500: (255,196,137),
    4000: (255,209,163),
    4500: (255,219,186),
    5000: (255,228,206),
    5500: (255,236,224),
    6000: (255,243,239),
    6500: (255,249,253),
    7000: (245,243,255),
    7500: (235,238,255),
    8000: (227,233,255),
    8500: (220,229,255),
    9000: (214,225,255),
    9500: (208,222,255),
    10000: (204,219,255)
}


def convert_temp(img, temp):

    res = Image.fromarray(img)
    print(res.mode)
    r, g, b = kelvin_table[temp]
    matrix = ( r / 255.0, 0.0, 0.0, 0.0,
               0.0, g / 255.0, 0.0, 0.0,
               0.0, 0.0, b / 255.0, 0.0 )
    res = cv2.cvtColor(np.array(res.convert('RGB', matrix)), cv2.COLOR_RGB2BGR)
    return res





def happy_effect(img):

    res = img.copy()
    gray = cv2.cvtColor(rgba2rgb(res), cv2.COLOR_BGR2GRAY)
    canny = cv2.Canny(gray, 90, 128)
    canny = cv2.dilate(canny, kernel=np.ones((3,3), dtype=np.uint8), iterations=1).astype(np.bool8)

    black_edge = np.logical_and(canny, gray<64).astype(np.uint8) * 255
    black_edge = cv2.dilate(black_edge, kernel=np.ones((3, 3), dtype=np.uint8), iterations=1)




    level = 22
    res[:,:,:3] = cv2.bilateralFilter(res[:,:,:3], level, level*2, level/2)

    res[:, :, 0][black_edge==255] = 0
    res[:, :, 1][black_edge==255] = 0
    res[:, :, 2][black_edge==255] = 0
    res[:, :, 3][black_edge==255] = 255

    return res

def angry_effect(img):



    b = img[:,:,0].astype(np.int16)
    g = img[:,:,1].astype(np.int16)
    r = img[:,:,2].astype(np.int16)

    gray = cv2.cvtColor(img[:,:,:3].copy(), cv2.COLOR_BGR2GRAY)
    
    
    mask_gray = (20<=gray) & (gray<=200) & \
        (np.abs(b - g)<50) & (np.abs(b - r)<50) & (np.abs(g - r)<50)




    blue_img = img.copy()
    blue_img[:,:,0][mask_gray] = np.clip(blue_img[:,:,0][mask_gray].astype(np.int16) + 150, 0, 255)
    

    

    b = blue_img[:,:,0].astype(np.int16)
    g = blue_img[:,:,1].astype(np.int16)
    r = blue_img[:,:,2].astype(np.int16)
    mask_blue = (b - g > 20) & (b - r > 20)
    
    red_img = convert_temp(blue_img[:,:,:3], 3000)


    res = img.copy()
    res[:,:,:3][mask_blue] = red_img[:,:,:3][mask_blue]
    res[:,:,0][mask_blue] = np.clip(res[:,:,0][mask_blue].astype(np.int16) - 20, 0, 255)
    res[:,:,1][mask_blue] = np.clip(res[:,:,1][mask_blue].astype(np.int16) - 20, 0, 255)



    

    return res

def suprise_effect(img):
    # print(img.shape)
    res = img.copy()

    # Turn the image into (128, 132, 135)
    res[:, :, 0] = 128
    res[:, :, 1] = 132
    res[:, :, 2] = 135

    # Extract edge using alpha channel.
    alpha_channel = res[:,:,3]
    alpha_channel = alpha_channel - cv2.erode(alpha_channel, np.ones((3, 3)), iterations=2)
    _, alpha_channel = cv2.threshold(alpha_channel, 100, 255, type=cv2.THRESH_BINARY)
    
    gray = cv2.cvtColor(img, cv2.COLOR_BGRA2GRAY)

    # Mask = alpha edge && dark color.
    mask = np.logical_and(alpha_channel==255, gray<128)
    




    # Mask the edge back to the result.
    (res[:,:,0])[mask>0] = (img[:,:,0])[mask>0]
    (res[:,:,1])[mask>0] = (img[:,:,1])[mask>0]
    (res[:,:,2])[mask>0] = (img[:,:,2])[mask>0]

    res = Image.fromarray(res)
    
    # Load and tile the crack texture.
    texture = Image.open("./input/cracked.jpg").convert(res.mode)
    texture = np.array(texture)
    texture = cv2.resize(texture, (0, 0), fx=3, fy=3)
    texture = np.tile(texture, (2, 2, 1))
    texture = Image.fromarray(texture[:img.shape[0], :img.shape[1]])
    
    # Blend the result with crack texture.
    res = Image.blend(res, texture, 0.3)
    res = np.array(res)
    
    return res


def art_effect(img):
    print(img.shape)
    alpha = img[:,:,3]
    texture = getLICTexture(img)

    # texture = cv2.imread("./input/back_texture.png", cv2.IMREAD_GRAYSCALE)
    
    texture_bgra = cv2.cvtColor(texture, cv2.COLOR_GRAY2BGRA)
    print(texture_bgra.shape)
    res = cv2.addWeighted(img, 0.6, texture_bgra, 0.4, 0)
    
    res[:,:,3] = alpha
    
    return res






def angryWave(img):
    # img = cv2.imread("./input/back0.png")
    
    A = img.shape[1] / 50.0
    w = 2.0 / img.shape[0]
    shift = lambda x: A * np.sin(5.0*np.pi*x * w)
    res = img.copy()
    for i in range(img.shape[1]):
        # img[:,i] = np.roll(img[:,i], int(shift(i)))
        for j in range(3):
            res[i,:,j] = np.roll(img[i,:,j], int(shift(i)))
    


    h, w = res.shape[:2]
    distCoeff = np.zeros((4,1),np.float64)


    distCoeff[0,0] = -1.0e-4
    distCoeff[1,0] = 0.0
    distCoeff[2,0] = 0.0
    distCoeff[3,0] = 0.0

    cam = np.eye(3,dtype=np.float32)

    cam[0,2] = w/2.0  # define center x
    cam[1,2] = h/3.0*2.0 # define center y
    cam[1,2] = h # define center y
    cam[0,0] = 20.        # define focal length x
    cam[1,1] = 8.        # define focal length y

    # here the undistortion will be computed
    res = cv2.undistort(res,cam,distCoeff)
    return res
