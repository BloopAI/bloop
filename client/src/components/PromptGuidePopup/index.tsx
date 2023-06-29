import React, { useContext } from 'react';
import ModalOrSidebar from '../ModalOrSidebar';
import Button from '../Button';
import { CloseSign } from '../../icons';
import { DeviceContext } from '../../context/deviceContext';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const PromptGuidePopup = ({ isOpen, onClose }: Props) => {
  const { openLink } = useContext(DeviceContext);
  return (
    <ModalOrSidebar
      isSidebar={false}
      shouldShow={isOpen}
      onClose={onClose}
      isModalSidebarTransition={false}
      setIsModalSidebarTransition={() => {}}
      shouldStretch={false}
      fullOverlay
      containerClassName="max-w-lg"
    >
      <div className="bg-bg-shade border border-bg-border shadow-float rounded-md select-none relative">
        <div className="w-full h-72 overflow-hidden relative">
          <img
            src="/light.png"
            alt=""
            className="fixed -top-44 -right-40 pointer-events-none opacity-[0.16] z-50"
          />
          <svg
            width="544"
            height="298"
            viewBox="0 0 544 298"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <g clipPath="url(#clip0_9642_277661)">
              <rect width="544" height="298" className="fill-bg-base" />
              <g filter="url(#filter0_b_9642_277661)">
                <rect
                  x="125.239"
                  y="62"
                  width="544.065"
                  height="91.0878"
                  rx="12.9451"
                  className="fill-bg-shade"
                  fillOpacity="0.35"
                />
                <g opacity="0.35">
                  <g clipPath="url(#clip1_9642_277661)">
                    <path
                      d="M164.392 105.779C167.317 105.779 169.688 103.408 169.688 100.483C169.688 97.5582 167.317 95.1872 164.392 95.1872C161.468 95.1872 159.097 97.5582 159.097 100.483C159.097 103.408 161.468 105.779 164.392 105.779Z"
                      className="fill-label-muted"
                    />
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M164.392 126.962C175.116 126.962 183.81 118.268 183.81 107.544C183.81 96.8198 175.116 88.1262 164.392 88.1262C153.668 88.1262 144.975 96.8198 144.975 107.544C144.975 118.268 153.668 126.962 164.392 126.962ZM164.392 109.309C158.822 109.309 154.112 113.065 152.569 118.157C150.042 115.343 148.505 111.623 148.505 107.544C148.505 98.7697 155.618 91.6567 164.392 91.6567C173.167 91.6567 180.28 98.7697 180.28 107.544C180.28 111.623 178.742 115.343 176.215 118.157C174.673 113.065 169.963 109.309 164.392 109.309Z"
                      className="fill-label-muted"
                    />
                  </g>
                  <g filter="url(#filter1_b_9642_277661)">
                    <rect
                      x="164.392"
                      y="114.016"
                      width="25.8903"
                      height="19.4177"
                      rx="9.70886"
                      className="fill-label-muted"
                    />
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M182.021 117.461C182.013 117.423 181.997 117.387 181.973 117.356C181.95 117.324 181.92 117.299 181.885 117.281C181.85 117.263 181.812 117.254 181.773 117.253C181.734 117.252 181.696 117.26 181.66 117.276C181.388 117.398 181.116 117.532 180.845 117.68C180.674 117.773 180.533 117.869 180.389 117.956C180.202 118.069 180.012 118.174 179.829 118.297C179.694 118.388 179.566 118.492 179.433 118.588C179.243 118.726 179.05 118.859 178.863 119.009C178.747 119.103 178.636 119.21 178.52 119.308C178.325 119.474 178.129 119.636 177.94 119.814C177.842 119.908 177.749 120.012 177.652 120.109C177.454 120.305 177.254 120.499 177.064 120.709C176.976 120.806 176.894 120.912 176.809 121.011C176.617 121.233 176.423 121.453 176.239 121.687C176.149 121.803 176.066 121.928 175.978 122.047C175.807 122.276 175.634 122.503 175.473 122.743C175.354 122.918 175.246 123.105 175.132 123.287C175.019 123.467 174.9 123.642 174.793 123.826C174.557 124.231 174.336 124.644 174.129 125.065C173.293 126.765 172.823 128.143 172.488 129.897C172.46 130.042 172.556 130.187 172.704 130.196C173.376 130.238 173.588 129.817 173.81 129.011C173.868 128.802 173.929 128.596 173.995 128.392C174.014 128.338 174.048 128.291 174.094 128.257C174.14 128.223 174.195 128.205 174.252 128.204C176.014 128.147 178.25 127.197 179.64 125.772C179.725 125.685 179.655 125.542 179.534 125.545C179.492 125.546 179.45 125.546 179.407 125.546C178.857 125.546 178.33 125.473 177.839 125.343C177.753 125.32 177.767 125.198 177.855 125.188C177.988 125.171 178.122 125.151 178.255 125.126C179.365 124.922 180.329 124.445 181.051 123.8C181.218 123.484 181.369 123.154 181.504 122.811C181.512 122.789 181.514 122.766 181.511 122.743C181.508 122.72 181.498 122.698 181.484 122.679C181.47 122.661 181.451 122.646 181.43 122.637C181.409 122.628 181.386 122.624 181.362 122.626C180.958 122.663 180.552 122.657 180.149 122.61C180.091 122.603 180.086 122.52 180.141 122.501C180.627 122.336 181.091 122.111 181.523 121.832C181.777 121.667 181.947 121.401 182.006 121.102C182.255 119.849 182.249 118.607 182.021 117.461V117.461Z"
                      className="fill-label-control"
                    />
                    <rect
                      x="162.774"
                      y="112.398"
                      width="29.1266"
                      height="22.654"
                      rx="11.327"
                      className="stroke-bg-shade"
                      strokeWidth="3.23629"
                    />
                  </g>
                </g>
                <g opacity="0.35">
                  <rect
                    x="209.382"
                    y="99.5439"
                    width="307"
                    height="16"
                    rx="8"
                    className="fill-label-muted"
                  />
                  <rect
                    x="524.382"
                    y="99.5439"
                    width="75"
                    height="16"
                    rx="8"
                    className="fill-label-muted"
                  />
                </g>
                <rect
                  x="125.643"
                  y="62.4045"
                  width="543.256"
                  height="90.2787"
                  rx="12.5406"
                  className="stroke-bg-border-hover"
                  strokeOpacity="0.35"
                  strokeWidth="0.809072"
                />
              </g>
              <rect
                x="89.542"
                y="103.851"
                width="615.458"
                height="89.8569"
                rx="12.9451"
                className="fill-bg-base-hover"
              />
              <rect
                x="89.9465"
                y="104.256"
                width="614.649"
                height="89.0478"
                rx="12.5406"
                className="stroke-bg-border-hover"
                strokeOpacity="0.75"
                strokeWidth="0.809072"
              />
              <g filter="url(#filter2_bd_9642_277661)">
                <rect
                  x="89.542"
                  y="103.851"
                  width="615.458"
                  height="89.8569"
                  rx="12.9451"
                  className="fill-bg-base"
                  fillOpacity="0.75"
                  shapeRendering="crispEdges"
                />
                <g opacity="0.5">
                  <g clipPath="url(#clip2_9642_277661)">
                    <path
                      d="M134.85 146.543C137.775 146.543 140.146 144.172 140.146 141.247C140.146 138.322 137.775 135.951 134.85 135.951C131.925 135.951 129.554 138.322 129.554 141.247C129.554 144.172 131.925 146.543 134.85 146.543Z"
                      className="fill-label-muted"
                    />
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M134.85 167.726C145.574 167.726 154.268 159.032 154.268 148.308C154.268 137.584 145.574 128.89 134.85 128.89C124.126 128.89 115.432 137.584 115.432 148.308C115.432 159.032 124.126 167.726 134.85 167.726ZM134.85 150.073C129.279 150.073 124.569 153.829 123.027 158.92C120.5 156.107 118.963 152.387 118.963 148.308C118.963 139.534 126.076 132.421 134.85 132.421C143.624 132.421 150.737 139.534 150.737 148.308C150.737 152.387 149.2 156.107 146.673 158.92C145.13 153.829 140.421 150.073 134.85 150.073Z"
                      className="fill-label-muted"
                    />
                  </g>
                  <g filter="url(#filter3_b_9642_277661)">
                    <rect
                      x="134.85"
                      y="154.78"
                      width="25.8903"
                      height="19.4177"
                      rx="9.70886"
                      className="fill-label-muted"
                    />
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M152.478 158.225C152.47 158.187 152.454 158.151 152.431 158.119C152.407 158.088 152.377 158.063 152.343 158.045C152.308 158.027 152.27 158.018 152.231 158.017C152.192 158.016 152.153 158.024 152.118 158.04C151.846 158.162 151.574 158.295 151.302 158.444C151.132 158.537 150.991 158.633 150.846 158.72C150.659 158.833 150.47 158.938 150.286 159.061C150.151 159.152 150.023 159.256 149.89 159.352C149.701 159.49 149.507 159.623 149.321 159.773C149.204 159.867 149.093 159.974 148.978 160.072C148.783 160.238 148.586 160.4 148.398 160.578C148.299 160.672 148.206 160.776 148.109 160.873C147.911 161.069 147.712 161.263 147.521 161.473C147.434 161.57 147.352 161.676 147.267 161.775C147.074 161.997 146.88 162.217 146.697 162.451C146.606 162.567 146.524 162.692 146.435 162.811C146.265 163.04 146.092 163.267 145.93 163.507C145.811 163.682 145.703 163.869 145.59 164.051C145.476 164.231 145.358 164.406 145.251 164.59C145.015 164.995 144.793 165.408 144.586 165.829C143.75 167.529 143.281 168.906 142.945 170.661C142.917 170.806 143.013 170.951 143.161 170.96C143.833 171.002 144.046 170.581 144.268 169.774C144.325 169.566 144.387 169.36 144.453 169.156C144.471 169.102 144.506 169.055 144.551 169.021C144.597 168.987 144.653 168.969 144.71 168.967C146.472 168.911 148.708 167.961 150.098 166.536C150.182 166.449 150.113 166.306 149.992 166.309C149.949 166.31 149.907 166.31 149.865 166.31C149.314 166.31 148.788 166.237 148.296 166.107C148.21 166.084 148.224 165.962 148.313 165.952C148.446 165.935 148.58 165.915 148.712 165.889C149.822 165.686 150.787 165.209 151.508 164.564C151.675 164.248 151.826 163.918 151.961 163.575C151.969 163.553 151.972 163.53 151.968 163.507C151.965 163.484 151.956 163.462 151.942 163.443C151.928 163.425 151.909 163.41 151.888 163.401C151.866 163.392 151.843 163.388 151.82 163.39C151.416 163.426 151.009 163.421 150.606 163.374C150.549 163.367 150.543 163.284 150.599 163.265C151.085 163.1 151.549 162.875 151.98 162.596C152.235 162.431 152.405 162.165 152.464 161.866C152.712 160.613 152.707 159.371 152.478 158.225V158.225Z"
                      className="fill-label-control"
                    />
                    <rect
                      x="133.231"
                      y="153.162"
                      width="29.1266"
                      height="22.654"
                      rx="11.327"
                      className="stroke-bg-shade"
                      strokeWidth="3.23629"
                    />
                  </g>
                </g>
                <g opacity="0.5">
                  <rect
                    x="173.686"
                    y="140.78"
                    width="307"
                    height="16"
                    rx="8"
                    className="fill-label-muted"
                  />
                  <rect
                    x="488.686"
                    y="140.78"
                    width="75"
                    height="16"
                    rx="8"
                    className="fill-label-muted"
                  />
                </g>
                <rect
                  x="89.9465"
                  y="104.256"
                  width="614.649"
                  height="89.0478"
                  rx="12.5406"
                  className="stroke-bg-border-hover"
                  strokeOpacity="0.75"
                  strokeWidth="0.809072"
                  shapeRendering="crispEdges"
                />
              </g>
              <g filter="url(#filter4_bd_9642_277661)">
                <rect
                  x="60"
                  y="144.471"
                  width="635.153"
                  height="91.0878"
                  rx="12.9451"
                  className="fill-bg-base-hover"
                />
                <g clipPath="url(#clip3_9642_277661)">
                  <path
                    d="M105.308 188.537C108.233 188.537 110.604 186.166 110.604 183.241C110.604 180.317 108.233 177.946 105.308 177.946C102.383 177.946 100.012 180.317 100.012 183.241C100.012 186.166 102.383 188.537 105.308 188.537Z"
                    className="fill-label-base"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M105.308 209.72C116.032 209.72 124.726 201.027 124.726 190.302C124.726 179.578 116.032 170.885 105.308 170.885C94.5837 170.885 85.8901 179.578 85.8901 190.302C85.8901 201.027 94.5837 209.72 105.308 209.72ZM105.308 192.068C99.7371 192.068 95.0274 195.823 93.485 200.915C90.958 198.102 89.4206 194.382 89.4206 190.302C89.4206 181.528 96.5336 174.415 105.308 174.415C114.082 174.415 121.195 181.528 121.195 190.302C121.195 194.382 119.658 198.102 117.131 200.915C115.588 195.823 110.879 192.068 105.308 192.068Z"
                    className="fill-label-base"
                  />
                </g>
                <g filter="url(#filter5_b_9642_277661)">
                  <rect
                    x="105.308"
                    y="196.775"
                    width="25.8903"
                    height="19.4177"
                    rx="9.70886"
                    className="fill-label-muted"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M122.936 200.219C122.928 200.181 122.912 200.145 122.889 200.114C122.865 200.083 122.835 200.058 122.801 200.04C122.766 200.022 122.728 200.012 122.689 200.011C122.65 200.01 122.611 200.018 122.576 200.034C122.304 200.156 122.032 200.29 121.76 200.438C121.59 200.531 121.449 200.627 121.304 200.715C121.117 200.827 120.928 200.933 120.744 201.056C120.609 201.147 120.481 201.251 120.348 201.347C120.159 201.485 119.965 201.618 119.779 201.768C119.662 201.861 119.551 201.968 119.436 202.067C119.241 202.233 119.044 202.395 118.856 202.573C118.757 202.666 118.664 202.77 118.567 202.867C118.369 203.064 118.17 203.258 117.979 203.468C117.892 203.564 117.81 203.671 117.725 203.77C117.532 203.992 117.338 204.211 117.155 204.445C117.064 204.562 116.982 204.686 116.893 204.806C116.723 205.035 116.55 205.261 116.388 205.501C116.269 205.677 116.161 205.864 116.048 206.045C115.934 206.225 115.816 206.4 115.709 206.585C115.473 206.99 115.251 207.403 115.044 207.823C114.208 209.524 113.739 210.901 113.403 212.655C113.375 212.801 113.471 212.946 113.619 212.955C114.291 212.996 114.504 212.575 114.726 211.769C114.783 211.561 114.845 211.355 114.911 211.151C114.929 211.097 114.964 211.05 115.009 211.016C115.055 210.982 115.111 210.963 115.168 210.962C116.93 210.905 119.166 209.956 120.556 208.531C120.64 208.444 120.571 208.301 120.45 208.303C120.407 208.304 120.365 208.304 120.323 208.304C119.772 208.304 119.246 208.232 118.754 208.101C118.668 208.079 118.682 207.957 118.771 207.946C118.904 207.93 119.038 207.91 119.17 207.884C120.28 207.68 121.245 207.204 121.966 206.558C122.133 206.243 122.284 205.913 122.419 205.569C122.427 205.548 122.43 205.524 122.426 205.501C122.423 205.478 122.414 205.456 122.4 205.438C122.386 205.42 122.367 205.405 122.346 205.396C122.324 205.386 122.301 205.383 122.278 205.385C121.874 205.421 121.467 205.416 121.064 205.369C121.007 205.362 121.001 205.278 121.057 205.26C121.543 205.094 122.007 204.87 122.438 204.591C122.693 204.425 122.863 204.159 122.922 203.861C123.17 202.608 123.165 201.366 122.936 200.219V200.219Z"
                    className="fill-label-control"
                  />
                  <rect
                    x="103.689"
                    y="195.157"
                    width="29.1266"
                    height="22.654"
                    rx="11.327"
                    className="stroke-bg-base-hover"
                    strokeWidth="3.23629"
                  />
                </g>
                <rect
                  x="144.144"
                  y="182.015"
                  width="75"
                  height="16"
                  rx="8"
                  className="fill-label-base"
                />
                <rect
                  x="227.144"
                  y="182.015"
                  width="307"
                  height="16"
                  rx="8"
                  className="fill-label-base"
                />
                <rect
                  x="60.4045"
                  y="144.876"
                  width="634.344"
                  height="90.2787"
                  rx="12.5406"
                  className="stroke-bg-border-hover"
                  strokeWidth="0.809072"
                />
              </g>
            </g>
            <defs>
              <filter
                id="filter0_b_9642_277661"
                x="60.513"
                y="-2.72572"
                width="673.516"
                height="220.539"
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
              >
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feGaussianBlur
                  in="BackgroundImageFix"
                  stdDeviation="32.3629"
                />
                <feComposite
                  in2="SourceAlpha"
                  operator="in"
                  result="effect1_backgroundBlur_9642_277661"
                />
                <feBlend
                  mode="normal"
                  in="SourceGraphic"
                  in2="effect1_backgroundBlur_9642_277661"
                  result="shape"
                />
              </filter>
              <filter
                id="filter1_b_9642_277661"
                x="148.211"
                y="97.8349"
                width="58.2531"
                height="51.7807"
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
              >
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feGaussianBlur
                  in="BackgroundImageFix"
                  stdDeviation="6.47257"
                />
                <feComposite
                  in2="SourceAlpha"
                  operator="in"
                  result="effect1_backgroundBlur_9642_277661"
                />
                <feBlend
                  mode="normal"
                  in="SourceGraphic"
                  in2="effect1_backgroundBlur_9642_277661"
                  result="shape"
                />
              </filter>
              <filter
                id="filter2_bd_9642_277661"
                x="9.54199"
                y="23.8511"
                width="775.458"
                height="249.857"
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
              >
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feGaussianBlur
                  in="BackgroundImageFix"
                  stdDeviation="32.3629"
                />
                <feComposite
                  in2="SourceAlpha"
                  operator="in"
                  result="effect1_backgroundBlur_9642_277661"
                />
                <feColorMatrix
                  in="SourceAlpha"
                  type="matrix"
                  values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                  result="hardAlpha"
                />
                <feOffset />
                <feGaussianBlur stdDeviation="40" />
                <feComposite in2="hardAlpha" operator="out" />
                <feColorMatrix
                  type="matrix"
                  values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.5 0"
                />
                <feBlend
                  mode="normal"
                  in2="effect1_backgroundBlur_9642_277661"
                  result="effect2_dropShadow_9642_277661"
                />
                <feBlend
                  mode="normal"
                  in="SourceGraphic"
                  in2="effect2_dropShadow_9642_277661"
                  result="shape"
                />
              </filter>
              <filter
                id="filter3_b_9642_277661"
                x="118.668"
                y="138.599"
                width="58.2531"
                height="51.7807"
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
              >
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feGaussianBlur
                  in="BackgroundImageFix"
                  stdDeviation="6.47257"
                />
                <feComposite
                  in2="SourceAlpha"
                  operator="in"
                  result="effect1_backgroundBlur_9642_277661"
                />
                <feBlend
                  mode="normal"
                  in="SourceGraphic"
                  in2="effect1_backgroundBlur_9642_277661"
                  result="shape"
                />
              </filter>
              <filter
                id="filter4_bd_9642_277661"
                x="-20"
                y="64.4714"
                width="795.153"
                height="251.088"
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
              >
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feGaussianBlur
                  in="BackgroundImageFix"
                  stdDeviation="32.3629"
                />
                <feComposite
                  in2="SourceAlpha"
                  operator="in"
                  result="effect1_backgroundBlur_9642_277661"
                />
                <feColorMatrix
                  in="SourceAlpha"
                  type="matrix"
                  values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
                  result="hardAlpha"
                />
                <feOffset />
                <feGaussianBlur stdDeviation="40" />
                <feComposite in2="hardAlpha" operator="out" />
                <feColorMatrix
                  type="matrix"
                  values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.5 0"
                />
                <feBlend
                  mode="normal"
                  in2="effect1_backgroundBlur_9642_277661"
                  result="effect2_dropShadow_9642_277661"
                />
                <feBlend
                  mode="normal"
                  in="SourceGraphic"
                  in2="effect2_dropShadow_9642_277661"
                  result="shape"
                />
              </filter>
              <filter
                id="filter5_b_9642_277661"
                x="89.1261"
                y="180.593"
                width="58.2531"
                height="51.7807"
                filterUnits="userSpaceOnUse"
                colorInterpolationFilters="sRGB"
              >
                <feFlood floodOpacity="0" result="BackgroundImageFix" />
                <feGaussianBlur
                  in="BackgroundImageFix"
                  stdDeviation="6.47257"
                />
                <feComposite
                  in2="SourceAlpha"
                  operator="in"
                  result="effect1_backgroundBlur_9642_277661"
                />
                <feBlend
                  mode="normal"
                  in="SourceGraphic"
                  in2="effect1_backgroundBlur_9642_277661"
                  result="shape"
                />
              </filter>
              <linearGradient
                id="paint0_linear_9642_277661"
                x1="90"
                y1="104"
                x2="604"
                y2="183"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#2C2C2E" />
                <stop offset="1" className="[stop-color:var(--bg-shade)]" />
              </linearGradient>
              <linearGradient
                id="paint1_linear_9642_277661"
                x1="90"
                y1="104"
                x2="604"
                y2="183"
                gradientUnits="userSpaceOnUse"
              >
                <stop className="[stop-color:var(--bg-shade)]" />
                <stop
                  offset="1"
                  className="[stop-color:var(--bg-shade)]"
                  stopOpacity="0"
                />
              </linearGradient>
              <clipPath id="clip0_9642_277661">
                <rect width="544" height="298" className="fill-label-control" />
              </clipPath>
              <clipPath id="clip1_9642_277661">
                <rect
                  x="144.975"
                  y="88.1262"
                  width="38.8354"
                  height="38.8354"
                  rx="19.4177"
                  className="fill-label-control"
                />
              </clipPath>
              <clipPath id="clip2_9642_277661">
                <rect
                  x="115.432"
                  y="128.89"
                  width="38.8354"
                  height="38.8354"
                  rx="19.4177"
                  className="fill-label-control"
                />
              </clipPath>
              <clipPath id="clip3_9642_277661">
                <rect
                  x="85.8901"
                  y="170.885"
                  width="38.8354"
                  height="38.8354"
                  rx="19.4177"
                  className="fill-label-control"
                />
              </clipPath>
            </defs>
          </svg>
        </div>
        <div className="flex flex-col items-center gap-8 py-8 px-6">
          <div className="flex flex-col gap-3">
            <h4 className="h4 text-label-title">Prompt guide</h4>
            <p className="body-s text-label-base">
              Like ChatGPT, bloop responds best to certain prompts. We’ve
              compiled a really quick guide on how better to prompt bloop.
            </p>
          </div>
          <div className="flex justify-between gap-3 w-full">
            <Button variant="tertiary" onClick={onClose}>
              Skip (Not recommended)
            </Button>
            <Button
              onClick={() => {
                openLink('https://bloop.ai/docs');
                onClose();
              }}
            >
              Take a quick look
            </Button>
          </div>
        </div>
        <div className="absolute top-2 right-2">
          <Button
            onlyIcon
            title="Close"
            variant="tertiary"
            size="small"
            onClick={onClose}
          >
            <CloseSign />
          </Button>
        </div>
      </div>
    </ModalOrSidebar>
  );
};

export default PromptGuidePopup;
