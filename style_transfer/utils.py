import cv2
import numpy as np



# return erode image and its edge
def separateEdge(img_rgba):

    gray = cv2.cvtColor(rgba2rgb(img_rgba), cv2.COLOR_BGR2GRAY)
    canny = cv2.Canny(gray, 30, 100)
    canny = cv2.dilate(canny, kernel=np.ones((3,3), dtype=np.uint8), iterations=1)

    img_edge = img_rgba.copy()
    img_edge[:,:,3] = canny

    img_erode =  img_rgba.copy()
    img_erode = img_erode.astype(np.int16) - transparent2color(img_edge, (0,0,0)).astype(np.int16)
    img_erode = np.clip(img_erode, 0, 255).astype(np.uint8)

    return img_erode, img_edge
    

def transparent2color(img_rgba, color=(255, 255, 255)):

    res = img_rgba.copy()
    r = res[:,:,0]
    g = res[:,:,1]
    b = res[:,:,2]
    a = res[:,:,3]
    r[a==0] = color[0]
    g[a==0] = color[1]
    b[a==0] = color[2]
    res[:,:,0] = r
    res[:,:,1] = g
    res[:,:,2] = b
    res[:,:,3] = a

    return res


def rgba2rgb( rgba, background=(255,255,255) ):
    h, w, channel = rgba.shape

    if channel == 3:
        return rgba

    assert channel == 4, 'RGBA image has 4 channels.'

    rgb = np.zeros( (h, w, 3), dtype=np.float32)
    r, g, b, alpha = rgba[:,:,0], rgba[:,:,1], rgba[:,:,2], rgba[:,:,3]

    alpha.astype(np.float32)
    alpha = alpha.astype(np.float32) / 255.0

    R, G, B = background

    rgb[:,:,0] = r * alpha + (1.0 - alpha) * R
    rgb[:,:,1] = g * alpha + (1.0 - alpha) * G
    rgb[:,:,2] = b * alpha + (1.0 - alpha) * B

    return rgb.astype(np.uint8)
    # return np.asarray( rgb, dtype='uint8' )



def combine(edge, nonEdge):
    res = nonEdge.copy()

    r_edge = edge[:,:,0]
    g_edge = edge[:,:,1]
    b_edge = edge[:,:,2]
    alpha_edge = edge[:,:,3]

    r_nonEdge = res[:,:,0]
    g_nonEdge = res[:,:,1]
    b_nonEdge = res[:,:,2]
    
    r_nonEdge[alpha_edge>0] = r_edge[alpha_edge>0]
    g_nonEdge[alpha_edge>0] = g_edge[alpha_edge>0]
    b_nonEdge[alpha_edge>0] = b_edge[alpha_edge>0]

    res[:,:,0] = r_nonEdge
    res[:,:,1] = g_nonEdge
    res[:,:,2] = b_nonEdge

    return res



if __name__ == "__main__":

    import argparse
    parser = argparse.ArgumentParser(description='')
    # python utils.py -i ./input/Haru_00.png -o ./extend_00.png -e 50
    # python utils.py -i ./input/Haru_01.png -o ./extend_01.png -e 50

    parser.add_argument('--input', '-i', type=str, help='input')
    parser.add_argument('--output', '-o', type=str, default='./output.jpg', help='output file name and path')
    parser.add_argument('--epoch', '-e', type=int, default=10, help='epoch')
    
    args = parser.parse_args()
    img = cv2.imread(args.input, cv2.IMREAD_UNCHANGED)

    # img_erosion = extendColor(img, epoch=args.epoch)

    
'''


const config = [


      // None   
      {
        "bg_add_r": 0.0,
        "bg_add_g": 0.0,
        "bg_add_b": 0.0,
        "model_r": 1.0,
        "model_g": 1.0,
        "model_b": 1.0,
        "contrast": 1.0,
      },
      // happy
      {
        "bg_add_r": 0.2,
        "bg_add_g": 0.2,
        "bg_add_b": 0.2,
        "model_r": 1.2,
        "model_g": 1.2,
        "model_b": 1.2,
        "contrast": 0.9,
      },

      // warm
      {
        "bg_add_r": 0.2,
        "bg_add_g": -0.3,
        "bg_add_b": -0.3,
        "model_r": 0.8,
        "model_g": 0.5,
        "model_b": 0.5,
        "contrast": 0.8,
      },
      // surprise
      {
        "bg_add_r": -0.1,
        "bg_add_g": -0.1,
        "bg_add_b": -0.1,
        "model_r": 0.9,
        "model_g": 0.9,
        "model_b": 0.9,
        "contrast": 0.9,
      },
      // eye
      {
        "bg_add_r": -0.3,
        "bg_add_g": -0.3,
        "bg_add_b": 0.0,
        "model_r": 1.0,
        "model_g": 1.0,
        "model_b": 1.0,
        "contrast": 0.8,
      },
      

      
      

      
    ];




'''